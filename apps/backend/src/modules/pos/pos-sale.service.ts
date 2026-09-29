import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ORDER_STATUS_CHANGED_EVENT,
  type OrderStatusChangedEvent,
} from '../orders/orders.events';
import { Locale, PaymentProvider, Prisma } from '@amader/db';
import { phoneLookupCandidates } from '@amader/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import { StoresService } from '../stores/stores.service';
import { PricingService } from '../cart/pricing.service';
import { SalesPostingService } from '../net-profit/accounts/ledger/sales-posting.service';
import { PosSettingsService } from './pos-settings.service';
import { dhakaRange } from './dhaka-range';
import { assertStoreActive } from '../stores/store-scope';
import { PaymentsService } from '../payments/payments.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  reclaimOrderCoupons,
  releaseOrderCoupons,
} from '../discounts/coupon-redemption';
import { generateOrderNumber } from '../orders/order-number.util';
import { redeemCoupon } from '../discounts/coupon-redemption';
import { CreatePosSaleDto } from './dto/create-pos-sale.dto';

const D = Prisma.Decimal;
const ZERO = new D(0);

export const POS_TRASH_DAYS = 30;
export const POS_SALE_COMPLETED_EVENT = 'pos.sale.completed';

const TENDER: Record<CreatePosSaleDto['tender'], PaymentProvider> = {
  CASH: 'CASH',
  CARD: 'CARD',
  MOBILE: 'BKASH',
};

export function posTotals(
  lines: { unitPrice: Prisma.Decimal; qty: number; vatRate: Prisma.Decimal }[],
  discount: Prisma.Decimal,
  vatOnTop: boolean,
) {
  const subTotal = lines.reduce(
    (s, l) => s.plus(l.unitPrice.times(l.qty)),
    ZERO,
  );
  const net = D.max(subTotal.minus(discount), ZERO);
  // The discount is spread across lines by value, so a VAT-exempt line keeps its share.
  const ratio = subTotal.isZero() ? ZERO : net.dividedBy(subTotal);
  const vat = lines
    .reduce((s, l) => {
      const base = l.unitPrice.times(l.qty).times(ratio);
      return s.plus(
        vatOnTop
          ? base.times(l.vatRate).dividedBy(100)
          : base.times(l.vatRate).dividedBy(l.vatRate.plus(100)),
      );
    }, ZERO)
    .toDecimalPlaces(2);
  return {
    subTotal: subTotal.toDecimalPlaces(2),
    vat,
    total: (vatOnTop ? net.plus(vat) : net).toDecimalPlaces(2),
  };
}

function toPosCustomer(c: {
  id: number;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
}) {
  return {
    id: c.id,
    name: [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Customer',
    phone: c.phone,
  };
}

type PosQuoteInput = Pick<
  CreatePosSaleDto,
  | 'items'
  | 'couponCode'
  | 'customerId'
  | 'manualDiscount'
  | 'manualDiscountType'
>;

/** The cashier's typed discount in ৳, on what is left after the coupon. */
export function manualDiscountAmount(
  base: Prisma.Decimal,
  value: number | undefined,
  type: 'AMOUNT' | 'PERCENT' | undefined,
): Prisma.Decimal {
  if (!value || value <= 0 || base.lessThanOrEqualTo(0)) return ZERO;
  const d =
    type === 'PERCENT'
      ? base.times(Math.min(value, 100)).dividedBy(100)
      : new D(value);
  return D.min(d, base).toDecimalPlaces(2);
}

@Injectable()
export class PosSaleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly stores: StoresService,
    private readonly pricing: PricingService,
    private readonly salesPosting: SalesPostingService,
    private readonly posSettings: PosSettingsService,
    private readonly payments: PaymentsService,
    private readonly events: EventEmitter2,
  ) {}

  /** Validates the cart and prices it exactly as a sale would. No writes. */
  private async price(storeId: number, dto: PosQuoteInput) {
    const products = await this.prisma.client.product.findMany({
      where: {
        id: { in: dto.items.map((i) => i.productId) },
        OR: [{ storeId: null }, { storeId }],
        storePrices: { none: { storeId, variantId: null, hidden: true } },
        // Same visibility as the POS catalog.
        deletedAt: null,
        status: { in: ['PUBLISHED', 'ADMIN_ONLY'] },
        productType: { not: 'DIGITAL' },
      },
      include: {
        translations: { where: { locale: Locale.EN }, take: 1 },
        variants: true,
      },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    for (const i of dto.items) {
      const p = byId.get(i.productId);
      if (!p)
        throw new BadRequestException(
          `Product #${i.productId} is not sold at this store`,
        );
      if (i.variantId && !p.variants.some((v) => v.id === i.variantId)) {
        throw new BadRequestException(
          `Variant #${i.variantId} does not belong to product #${i.productId}`,
        );
      }
    }

    const cartLines = dto.items.map((i) => ({
      productId: i.productId,
      variantId: i.variantId ?? null,
      quantity: i.quantity,
    }));
    const priced = await this.pricing.priceLines(cartLines, storeId);
    // A product with no price set would otherwise ring up at ৳0.
    priced.forEach((l, idx) => {
      if (!new D(l.unitPrice).greaterThan(0)) {
        const name = byId.get(dto.items[idx].productId)?.translations[0]?.name;
        throw new BadRequestException(
          `${name ?? `Product #${l.productId}`} has no price set`,
        );
      }
    });

    // Discounts come only from validated coupons: a free-typed amount would
    // let anyone with pos.access hand goods over for nothing.
    // ponytail: add a gated, audited manual discount if stores need one.
    let discount = ZERO;
    let couponUsed = false;
    if (dto.couponCode) {
      const p = await this.pricing.price(cartLines, {
        couponCode: dto.couponCode,
        customerId: dto.customerId,
        // Till context: POS-only coupons are allowed, store-limited ones checked.
        pos: { storeId },
      });
      if (p.couponError) throw new BadRequestException(p.couponError);
      // Same rule as AdminOrderCreationService.resolveCartDiscount: the coupon,
      // or the upsell stage that replaced it — never surprise promotions.
      const coupon = new D(
        p.discounts.find((d) => d.source === 'COUPON')?.amount ?? 0,
      );
      const upsell = new D(
        p.discounts.find((d) => d.source === 'UPSELL')?.amount ?? 0,
      );
      discount = discount.plus(D.max(coupon, upsell));
      couponUsed = coupon.greaterThan(0);
    }

    // ponytail: open to anyone with till access, no limit (owner's call,
    // 2026-09-28); each sale records it (posManualDiscount) with the cashier.
    const itemsTotal = dto.items.reduce(
      (s, i, idx) => s.plus(new D(priced[idx].unitPrice).times(i.quantity)),
      ZERO,
    );
    const manualDiscount = manualDiscountAmount(
      D.max(itemsTotal.minus(discount), ZERO),
      dto.manualDiscount,
      dto.manualDiscountType,
    );
    discount = discount.plus(manualDiscount);

    // POS Settings › VAT (one setting for all stores).
    const vat = await this.posSettings.getVat();
    const storeRate = new D(vat.enabled ? vat.ratePercent : 0);
    const vatOnTop = !vat.pricesIncludeVat;
    const totals = posTotals(
      dto.items.map((i, idx) => ({
        unitPrice: new D(priced[idx].unitPrice),
        qty: i.quantity,
        vatRate: vat.enabled
          ? (byId.get(i.productId)!.vatRatePercent ?? storeRate)
          : ZERO,
      })),
      discount,
      vatOnTop,
    );

    // VAT coupon: VAT stays on the receipt (and owed), then comes off the total.
    const vatDiscount = vat.vatDiscount ? D.min(totals.vat, totals.total) : ZERO;
    return {
      byId,
      priced,
      discount,
      manualDiscount,
      couponUsed,
      totals: { ...totals, total: totals.total.minus(vatDiscount) },
      vatDiscount,
      vatOnTop,
      vatRatePercent: vat.enabled ? vat.ratePercent : 0,
    };
  }

  /** What the till shows before "Complete Sale" — same maths as create(). */
  async quote(storeId: number, dto: PosQuoteInput) {
    const {
      discount,
      manualDiscount,
      totals,
      vatDiscount,
      vatOnTop,
      vatRatePercent,
    } = await this.price(storeId, dto);
    return {
      subTotal: totals.subTotal.toFixed(2),
      discount: D.min(discount, totals.subTotal).toFixed(2),
      manualDiscount: manualDiscount.toFixed(2),
      vat: totals.vat.toFixed(2),
      vatDiscount: vatDiscount.toFixed(2),
      total: totals.total.toFixed(2),
      vatOnTop,
      vatRatePercent,
    };
  }

  async create(storeId: number, input: CreatePosSaleDto, adminId: number) {
    assertStoreActive(
      await this.prisma.client.store.findUniqueOrThrow({
        where: { id: storeId },
      }),
    );
    // Fast checkout: a phone typed but no customer picked → find or create
    // the customer by that number and attach the sale (name optional).
    const dto =
      !input.customerId && input.customerPhone
        ? {
            ...input,
            customerId: (
              await this.quickCustomer(input.customerPhone, input.customerName)
            ).id,
          }
        : input;
    const {
      byId,
      priced,
      discount,
      manualDiscount,
      couponUsed,
      totals,
      vatDiscount,
    } = await this.price(storeId, dto);
    const tendered =
      dto.tender === 'CASH'
        ? new D(dto.tenderedAmount ?? totals.total)
        : totals.total;
    if (tendered.lessThan(totals.total))
      throw new BadRequestException('Cash received is less than the total');
    const provider = TENDER[dto.tender];
    const now = new Date();

    const storeNames = new Map(
      (
        await this.prisma.client.storePrice.findMany({
          where: {
            storeId,
            productId: { in: dto.items.map((i) => i.productId) },
            name: { not: null },
          },
          select: { productId: true, variantId: true, name: true },
        })
      ).map((r) => [`${r.productId}:${r.variantId ?? 0}`, r.name!]),
    );
    const order = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          // Completed on creation: goods leave with the customer. completedAt
          // set means OrdersService treats a later return as a restock (to
          // this store — see OrdersService.posStoreId).
          status: 'COMPLETED',
          completedAt: now,
          confirmedAt: now,
          channel: 'POS',
          storeId,
          customerId: dto.customerId ?? null,
          assignedAdminId: adminId,
          subTotal: totals.subTotal,
          // Coupon + manual + VAT coupon; taxAmount below still records the
          // VAT owed, so a VAT coupon comes out of the store's revenue.
          discountAmount: D.min(discount, totals.subTotal).plus(vatDiscount),
          posManualDiscount: manualDiscount,
          posVatDiscount: vatDiscount,
          // VAT collected — added on top or contained in the price alike.
          taxAmount: totals.vat,
          codFee: ZERO,
          shippingAmount: ZERO,
          totalAmount: totals.total,
          tenderedAmount: dto.tender === 'CASH' ? tendered : null,
          couponCode: couponUsed ? dto.couponCode : undefined,
          items: {
            create: dto.items.map((i, idx) => {
              const p = byId.get(i.productId)!;
              const v = i.variantId
                ? p.variants.find((x) => x.id === i.variantId)
                : undefined;
              return {
                productId: p.id,
                variantId: i.variantId ?? null,
                // This store's own name for it, if it has one.
              productNameSnapshot:
                storeNames.get(`${p.id}:${i.variantId ?? 0}`) ??
                p.translations[0]?.name ??
                p.slug,
                skuSnapshot: v?.sku ?? p.sku,
                productTypeSnapshot: p.productType,
                unitPrice: priced[idx].unitPrice,
                quantity: i.quantity,
              };
            }),
          },
          statusHistory: {
            create: {
              status: 'COMPLETED',
              note: 'POS sale',
              adminUserId: adminId,
            },
          },
        },
      });
      for (const i of dto.items) {
        await this.stock.move(tx, {
          storeId,
          productId: i.productId,
          variantId: i.variantId ?? null,
          type: 'SALE',
          qty: -i.quantity,
          orderId: created.id,
          adminUserId: adminId,
        });
      }
      await tx.payment.create({
        data: {
          orderId: created.id,
          provider,
          status: 'CAPTURED',
          amount: totals.total,
          transactionRef: dto.transactionRef,
        },
      });
      if (couponUsed && dto.couponCode) {
        await redeemCoupon(tx, {
          code: dto.couponCode,
          orderId: created.id,
          customerId: dto.customerId ?? null,
          phone: dto.customerPhone ?? null,
        });
      }
      if (dto.heldSaleId)
        await tx.posHeldSale.deleteMany({
          where: { id: dto.heldSaleId, storeId },
        });
      return created;
    });

    // After commit, best-effort: SalesPostingService logs failures, never throws.
    await this.salesPosting.postPrepaidCapture({
      orderId: order.id,
      amount: totals.total,
      capturedAt: now,
      reference: dto.transactionRef,
      accountId: await this.stores.tenderAccountId(storeId, provider),
    });
    // Thank-you SMS + tier-upgrade campaigns (PosSmsService); async so the
    // till never waits on the SMS gateway.
    this.events.emit(POS_SALE_COMPLETED_EVENT, { orderId: order.id });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: totals.total.toFixed(2),
      change: tendered.minus(totals.total).toFixed(2),
    };
  }

  recent(storeId: number | null, date?: string) {
    const { gte: from, lt: to } = dhakaRange(date, date);
    return this.prisma.client.order.findMany({
      where: {
        channel: 'POS',
        deletedAt: null,
        ...(storeId ? { storeId } : {}),
        createdAt: { gte: from, lt: to },
      },
      include: {
        items: true,
        payments: { take: 1, orderBy: { createdAt: 'desc' } },
        store: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(storeId: number | null, id: number) {
    const o = await this.prisma.client.order.findFirst({
      where: { id, channel: 'POS', ...(storeId ? { storeId } : {}) },
      include: {
        items: {
          include: {
            product: { select: { shippableWeight: true, weightUnit: true } },
            variant: {
              include: {
                attributeValues: {
                  include: {
                    attributeValue: {
                      include: {
                        translations: { where: { locale: Locale.EN }, take: 1 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        payments: true,
        store: true,
        customer: true,
        assignedAdmin: { select: { firstName: true, lastName: true } },
      },
    });
    if (!o) throw new NotFoundException('Sale not found');
    // This store's own weights override the product's on its receipts.
    const storeWeights = o.storeId
      ? await this.prisma.client.storePrice.findMany({
          where: {
            storeId: o.storeId,
            productId: { in: o.items.flatMap((i) => (i.productId ? [i.productId] : [])) },
            weightKg: { not: null },
          },
          select: {
            productId: true,
            variantId: true,
            weightKg: true,
            weightUnit: true,
          },
        })
      : [];
    const storeRow = (productId: number | null, variantId: number | null) =>
      storeWeights.find(
        (w) =>
          w.productId === productId &&
          (w.variantId ?? null) === (variantId ?? null),
      );
    const storeWeight = (productId: number | null, variantId: number | null) =>
      storeRow(productId, variantId)?.weightKg;
    // The receipt must tell a 1kg jar from a 500g one.
    return {
      ...o,
      items: o.items.map(({ variant, product, ...i }) => ({
        ...i,
        // Printed on the receipt; the product's current weight (kg).
        // ponytail: not snapshotted per sale — a reprint after a weight
        // edit shows the new weight. Snapshot on order_items if that matters.
        weightKg:
          (
            storeWeight(i.productId, i.variantId) ??
            variant?.weightOverride ??
            product?.shippableWeight
          )?.toString() ?? null,
        weightUnit: storeWeight(i.productId, i.variantId)
          ? (storeRow(i.productId, i.variantId)?.weightUnit ?? null)
          : (product?.weightUnit ?? null),
        /** Set for this store: printed even next to a variant label. */
        storeWeight: storeWeight(i.productId, i.variantId) != null,
        variantLabel:
          variant?.attributeValues
            .map((a) => a.attributeValue.translations[0]?.value)
            .filter(Boolean)
            .join(' / ') || null,
      })),
    };
  }

  /** Full return: claim the order, stock back to its store, money back from the same account. */
  async returnSale(
    storeId: number | null,
    id: number,
    adminId: number,
    reason?: string,
  ) {
    const o = await this.get(storeId, id);
    if (o.status !== 'COMPLETED')
      throw new BadRequestException('Only a completed sale can be returned');
    // ponytail: whole-sale return only; per-line partial returns need an
    // OrderReturn table — add when a store asks for it.
    await this.prisma.client.$transaction(async (tx) => {
      // Claim first: of two concurrent returns (two tabs, POS + Order
      // Manager) exactly one flips the status; the other stops here before
      // any stock or money moves.
      const { count } = await tx.order.updateMany({
        where: { id, status: 'COMPLETED' },
        data: { status: 'RETURNED', returnedAt: new Date() },
      });
      if (count !== 1)
        throw new ConflictException('This sale was already returned');
      for (const i of o.items) {
        if (!i.productId || !o.storeId) continue;
        await this.stock.move(tx, {
          storeId: o.storeId,
          productId: i.productId,
          variantId: i.variantId,
          type: 'RETURN',
          qty: i.quantity,
          orderId: id,
          adminUserId: adminId,
        });
      }
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          status: 'RETURNED',
          note: reason ?? 'POS return',
          adminUserId: adminId,
        },
      });
    });
    await this.payments.refund(id, o.totalAmount);
    this.events.emit(ORDER_STATUS_CHANGED_EVENT, {
      orderId: id,
      from: 'COMPLETED',
      to: 'RETURNED',
    } satisfies OrderStatusChangedEvent);
    return this.get(storeId, id);
  }

  /**
   * Order Manager "Delete": a completed sale is first undone like a return
   * (stock back, money reversed), then moved to the Trash. The books stay
   * right whether it is later restored or purged.
   */
  async deleteSale(storeId: number | null, id: number, adminId: number) {
    const o = await this.get(storeId, id);
    if (o.deletedAt) throw new BadRequestException('Already in the Trash');
    const wasCompleted = o.status === 'COMPLETED';
    if (wasCompleted)
      await this.returnSale(storeId, id, adminId, 'Deleted from Order Manager');
    await this.prisma.client.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: { deletedAt: new Date(), posVoidedByDelete: wasCompleted },
      });
      await releaseOrderCoupons(tx, id);
    });
    return { deleted: true, undone: wasCompleted };
  }

  /** Back from the Trash; a sale that delete undid is re-applied (stock out, money in). */
  async restoreSale(storeId: number | null, id: number, adminId: number) {
    const o = await this.get(storeId, id);
    if (!o.deletedAt) throw new NotFoundException('Sale is not in the Trash');
    if (!o.posVoidedByDelete) {
      await this.prisma.client.$transaction(async (tx) => {
        await tx.order.update({ where: { id }, data: { deletedAt: null } });
        if (o.status !== 'CANCELED') await reclaimOrderCoupons(tx, id);
      });
      return this.get(storeId, id);
    }
    const now = new Date();
    await this.prisma.client.$transaction(async (tx) => {
      // Claim first so two restores can't sell the goods twice.
      const { count } = await tx.order.updateMany({
        where: { id, status: 'RETURNED', deletedAt: { not: null } },
        data: {
          status: 'COMPLETED',
          returnedAt: null,
          deletedAt: null,
          posVoidedByDelete: false,
        },
      });
      if (count !== 1)
        throw new ConflictException('This sale was already restored');
      for (const i of o.items) {
        if (!i.productId || !o.storeId) continue;
        // Throws if the store no longer has the stock — nothing is restored then.
        await this.stock.move(tx, {
          storeId: o.storeId,
          productId: i.productId,
          variantId: i.variantId,
          type: 'SALE',
          qty: -i.quantity,
          orderId: id,
          adminUserId: adminId,
        });
      }
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          status: 'COMPLETED',
          note: 'Restored from Trash',
          adminUserId: adminId,
        },
      });
      await tx.payment.updateMany({
        where: { orderId: id },
        data: { status: 'CAPTURED', refundedAmount: null },
      });
      await reclaimOrderCoupons(tx, id);
    });
    const pay = o.payments[0];
    await this.salesPosting.postPrepaidCapture({
      orderId: id,
      amount: new D(o.totalAmount),
      capturedAt: now,
      reference: pay?.transactionRef ?? undefined,
      accountId: o.storeId && pay
        ? await this.stores.tenderAccountId(o.storeId, pay.provider)
        : undefined,
    });
    return this.get(storeId, id);
  }

  /** Sales in the Trash (one store or all). */
  trash(storeId: number | null) {
    return this.prisma.client.order.findMany({
      where: {
        channel: 'POS',
        deletedAt: { not: null },
        ...(storeId ? { storeId } : {}),
      },
      orderBy: { deletedAt: 'desc' },
      take: 200,
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        deletedAt: true,
        totalAmount: true,
        posVoidedByDelete: true,
        store: { select: { name: true } },
        customer: { select: { firstName: true, lastName: true, phone: true } },
      },
    });
  }

  /**
   * Daily: sales 30+ days in the Trash are removed for good. They were
   * undone on delete, so their ledger entries (sale in, refund out) and
   * stock moves net to zero and are kept, just unlinked from the order.
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async purgeTrash(now = new Date()) {
    const old = await this.prisma.client.order.findMany({
      where: {
        channel: 'POS',
        deletedAt: { lt: new Date(now.getTime() - POS_TRASH_DAYS * 86_400_000) },
        status: { not: 'COMPLETED' },
      },
      select: { id: true },
    });
    let purged = 0;
    for (const { id } of old) {
      try {
        await this.prisma.client.order.delete({ where: { id } });
        purged++;
      } catch {
        // ponytail: a row still referencing the order blocks it; it retries
        // tomorrow. Log/alert if this ever shows up in practice.
      }
    }
    return { purged };
  }

  // Cashiers don't hold customer.view; these expose only name + phone.
  async findCustomers(q: string) {
    const term = q.trim();
    if (term.length < 2) return [];
    const rows = await this.prisma.client.customer.findMany({
      where: {
        deletedAt: null,
        OR: [
          { phone: { in: phoneLookupCandidates(term) } },
          { phone: { contains: term } },
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName: { contains: term, mode: 'insensitive' } },
        ],
      },
      take: 10,
    });
    return rows.map(toPosCustomer);
  }

  /** Find-or-create by phone: a walk-in who already shopped online keeps one record. */
  async quickCustomer(phone: string, name?: string) {
    const existing = await this.prisma.client.customer.findFirst({
      where: { phone: { in: phoneLookupCandidates(phone) } },
    });
    if (existing) return toPosCustomer(existing);
    const created = await this.prisma.client.customer.create({
      data: { phone, ...(name?.trim() ? { firstName: name.trim() } : {}) },
    });
    return toPosCustomer(created);
  }

  held(storeId: number) {
    return this.prisma.client.posHeldSale.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  hold(
    storeId: number,
    adminId: number,
    label: string,
    cart: Record<string, unknown>,
  ) {
    return this.prisma.client.posHeldSale.create({
      data: {
        storeId,
        adminUserId: adminId,
        label,
        cart: cart as Prisma.InputJsonValue,
      },
    });
  }

  async dropHeld(storeId: number, id: number): Promise<void> {
    await this.prisma.client.posHeldSale.deleteMany({ where: { id, storeId } });
  }
}
