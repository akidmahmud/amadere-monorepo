import { BadRequestException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Locale, OrderAddressType, Prisma } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppliedDiscount, PricingService } from '../cart/pricing.service';
import { PaymentsService } from '../payments/payments.service';
import { CreateManualOrderDto } from './dto/create-manual-order.dto';
import { PreviewCouponDto, PreviewCouponResultDto } from './dto/preview-coupon.dto';
import { generateOrderNumber } from './order-number.util';
import { reserveStock } from './stock-reservation.util';
import { toOrderAddressCreate } from './order-address.util';
import { ORDER_INCLUDE, OrderDto, toOrderDto } from './orders.mapper';
import { ORDER_CREATED_EVENT, OrderCreatedEvent } from './orders.events';
import { OrderEmailsService } from '../order-emails/order-emails.service';
import { DownloadsService } from '../digital-products/downloads.service';

const Decimal = Prisma.Decimal;

// Staff-facing "create order over the phone" path — deliberately does not
// call FraudService/BlockerService/OtpSecurityService/AdvancePaymentService
// (docs/superpowers/specs/2026-07-18-new-order-panel-design.md, Non-goals):
// those gates exist to catch bots/fake storefront submissions, not orders a
// staff member is directly taking from a verified customer. Emits the same
// ORDER_CREATED_EVENT real checkout does, so CustomerOrderEventListener's
// existing auto-match/create-by-phone logic (Customer Panel) handles the
// customer side with zero changes to that listener.
@Injectable()
export class AdminOrderCreationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly payments: PaymentsService,
    private readonly events: EventEmitter2,
    private readonly orderEmails: OrderEmailsService,
    private readonly downloads: DownloadsService,
  ) {}

  // Preview-only — reuses the exact same coupon validation the real create()
  // below runs (expiry, usage limits, min order amount, product/category
  // scope), so the New Order form's Total amount can reflect a real coupon
  // discount before the staff member actually submits the order.
  async previewCoupon(dto: PreviewCouponDto): Promise<PreviewCouponResultDto> {
    const pricing = await this.pricing.price(
      dto.items.map((i) => ({ productId: i.productId, variantId: i.variantId ?? null, quantity: i.quantity })),
      { couponCode: dto.couponCode, customerId: dto.customerId },
    );
    if (pricing.couponError) {
      return { amount: '0', error: pricing.couponError };
    }
    // Same resolution create() uses, so the previewed figure is exactly
    // what gets charged even when an upsell stage outvalues the coupon.
    return { amount: this.resolveCartDiscount(pricing.discounts).appliedAmount.toString() };
  }

  // What this cart is actually entitled to off the top, for a staff-entered
  // coupon code. PricingService.applyUpsellBar() applies whichever is bigger
  // — the coupon/promotion side or the best-matched upsell-bar stage — never
  // both, and zeroes the losing side's amount. So reading only the COUPON
  // entry (as this service used to) hands the customer ৳0 whenever an upsell
  // stage beat their coupon: the stage's discount is never substituted
  // anywhere else, because manual-order totals are assembled from explicit
  // line-item/discount fields rather than `pricing.totalDiscount`. Taking the
  // max of the two restores the engine's "bigger wins" rule.
  //
  // PROMOTION entries stay deliberately ignored here (a staff-created order
  // must never pick up a surprise discount the staff didn't ask for) — the
  // UPSELL entry is only honoured because it exists *in place of* the coupon
  // the staff did ask for.
  private resolveCartDiscount(discounts: AppliedDiscount[]): {
    couponAmount: Prisma.Decimal;
    appliedAmount: Prisma.Decimal;
  } {
    const couponAmount = discounts.find((d) => d.source === 'COUPON')?.amount ?? new Decimal(0);
    const upsellAmount = discounts.find((d) => d.source === 'UPSELL')?.amount ?? new Decimal(0);
    return { couponAmount, appliedAmount: Decimal.max(couponAmount, upsellAmount) };
  }

  async create(dto: CreateManualOrderDto, adminId: number): Promise<OrderDto> {
    const products = await this.prisma.client.product.findMany({
      where: { id: { in: dto.items.map((i) => i.productId) } },
      include: {
        translations: { where: { locale: Locale.EN }, take: 1 },
        variants: true,
      },
    });
    const productsById = new Map(products.map((p) => [p.id, p]));

    for (const item of dto.items) {
      const product = productsById.get(item.productId);
      if (!product) {
        throw new BadRequestException(`Product #${item.productId} not found`);
      }
      if (item.variantId && !product.variants.some((v) => v.id === item.variantId)) {
        throw new BadRequestException(
          `Variant #${item.variantId} does not belong to product #${item.productId}`,
        );
      }
    }

    // Real, sale-window-aware price per line — same effectivePrice logic
    // storefront checkout uses (PricingService.priceLines).
    const pricedLines = await this.pricing.priceLines(
      dto.items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId ?? null,
        quantity: i.quantity,
      })),
    );

    const subTotal = pricedLines.reduce((sum, l) => sum.plus(l.lineTotal), new Decimal(0));
    const lineItemsTotal = dto.items.reduce((sum, item, idx) => {
      const effective = item.unitPrice !== undefined ? new Decimal(item.unitPrice) : pricedLines[idx].unitPrice;
      return sum.plus(effective.times(item.quantity));
    }, new Decimal(0));
    // Per-line price overrides (unitPrice below catalog price) are an
    // implicit discount on top of whatever the staff also typed into the
    // explicit "discount"/"promotion" fields — all three roll into the one
    // stored Order.discountAmount, same as the real checkout's own subTotal
    // vs. totalAmount relationship.
    const lineDiscount = Decimal.max(subTotal.minus(lineItemsTotal), new Decimal(0));
    const explicitDiscount = dto.discountAmount != null ? new Decimal(dto.discountAmount) : new Decimal(0);
    const explicitPromotion = dto.promotionAmount != null ? new Decimal(dto.promotionAmount) : new Decimal(0);
    const taxAmount = dto.taxAmount != null ? new Decimal(dto.taxAmount) : new Decimal(0);
    const shippingAmount = dto.shippingAmount != null ? new Decimal(dto.shippingAmount) : new Decimal(0);

    // Reuses the exact same coupon validation real checkout runs (expiry,
    // usage limits, min order amount, product/category scope) — only the
    // COUPON entry (or the UPSELL stage that replaced it, see
    // resolveCartDiscount) from the result is used; any auto-applied
    // BUNDLE/PROMOTION discounts it also computes are deliberately ignored
    // here so a staff-created order never picks up a surprise discount the
    // staff didn't ask for.
    // `couponAmount` = what the coupon itself contributed (0 if an upsell
    // stage outvalued it); `codeDiscount` = what actually comes off the
    // order. Only the former decides whether the coupon code is recorded
    // and redeemed, so a coupon that contributed nothing never gets one of
    // its limited uses burned or shows up on the order as if it had paid off.
    let couponAmount = new Decimal(0);
    let codeDiscount = new Decimal(0);
    if (dto.couponCode) {
      const pricing = await this.pricing.price(
        dto.items.map((i) => ({ productId: i.productId, variantId: i.variantId ?? null, quantity: i.quantity })),
        { couponCode: dto.couponCode, customerId: dto.customerId },
      );
      if (pricing.couponError) {
        throw new BadRequestException(pricing.couponError);
      }
      ({ couponAmount, appliedAmount: codeDiscount } = this.resolveCartDiscount(pricing.discounts));
    }

    const discountAmount = lineDiscount.plus(explicitDiscount).plus(explicitPromotion).plus(codeDiscount);
    const preFeeTotal = Decimal.max(
      lineItemsTotal.minus(explicitDiscount).minus(explicitPromotion).minus(codeDiscount),
      new Decimal(0),
    );
    // No automatic COD fee here — per explicit request, the COD fee (like
    // tax) is an internal accounting-only figure and must never be added to
    // what a customer is actually charged, on any order regardless of how
    // it was created. `taxAmount` above stays staff-entered/optional (an
    // admin explicitly typing a tax line for a manual invoice is a
    // deliberate per-order choice, not an automatic silent charge).
    const codFee = new Decimal(0);
    const totalAmount = preFeeTotal.plus(taxAmount).plus(shippingAmount).plus(codFee);

    const shippingAddressData = toOrderAddressCreate(dto.shippingAddress, OrderAddressType.SHIPPING);
    const billingAddressData = toOrderAddressCreate(dto.billingAddress ?? dto.shippingAddress, OrderAddressType.BILLING);

    const order = await this.prisma.client.$transaction(async (tx) => {
      for (const item of dto.items) {
        await reserveStock(tx, item.productId, item.variantId ?? null, item.quantity);
      }

      const created = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          // Confirmed on creation, not left on the schema's PENDING default.
          // A manual order is typed in by staff who already have the customer
          // on the phone — the confirmation step exists to verify a
          // self-service web order is real, and there is nothing left to verify
          // here. Leaving it PENDING meant every admin-created order needed a
          // pointless extra click in the order modal before it could be sent to
          // a courier.
          status: 'CONFIRMED',
          channel: dto.channel,
          customerId: dto.customerId ?? null,
          assignedAdminId: adminId,
          subTotal,
          discountAmount,
          taxAmount,
          codFee,
          shippingAmount,
          totalAmount,
          couponCode: couponAmount.greaterThan(0) ? dto.couponCode : undefined,
          customerNote: dto.customerNote,
          items: {
            create: dto.items.map((item, idx) => {
              const product = productsById.get(item.productId)!;
              const variant = item.variantId
                ? product.variants.find((v) => v.id === item.variantId)
                : undefined;
              const effective =
                item.unitPrice !== undefined ? new Decimal(item.unitPrice) : pricedLines[idx].unitPrice;
              return {
                productId: item.productId,
                variantId: item.variantId ?? null,
                productNameSnapshot: product.translations[0]?.name ?? product.slug,
                skuSnapshot: variant?.sku ?? product.sku,
                productTypeSnapshot: product.productType,
                unitPrice: effective,
                quantity: item.quantity,
              };
            }),
          },
          addresses: {
            create: [shippingAddressData, billingAddressData],
          },
          statusHistory: {
            create: { status: 'CONFIRMED', note: 'Order created and confirmed by staff', adminUserId: adminId },
          },
        },
      });

      // Keep the customer's saved default address in sync with whatever the
      // staff actually entered/edited on this order — otherwise it's frozen
      // forever at whatever was captured on the customer's very first order
      // (CustomerOrderEventListener's backfill only ever runs once), so a
      // corrected or updated thana/address here would never show up next
      // time this customer is picked in New Order.
      if (dto.customerId) {
        const existingDefault = await tx.customerAddress.findFirst({
          where: { customerId: dto.customerId, isDefault: true },
        });
        const addressFields = {
          recipientName: shippingAddressData.recipientName,
          phone: shippingAddressData.phone,
          division: shippingAddressData.division,
          district: shippingAddressData.district,
          area: shippingAddressData.area,
          landmark: shippingAddressData.landmark,
          addressLine: shippingAddressData.addressLine,
          postCode: shippingAddressData.postCode,
        };
        if (existingDefault) {
          await tx.customerAddress.update({ where: { id: existingDefault.id }, data: addressFields });
        } else {
          await tx.customerAddress.create({ data: { customerId: dto.customerId, isDefault: true, ...addressFields } });
        }
      }

      // resolve() is async now (BKASH's gateway-vs-manual answer lives in
      // the database). Staff-created orders are always recorded as already
      // arranged offline, so this never reaches a hosted gateway.
      const authResult = await (
        await this.payments.resolve(dto.paymentProvider)
      ).authorize(created.id, totalAmount);
      await tx.payment.create({
        data: {
          orderId: created.id,
          provider: dto.paymentProvider,
          // Staff-provided values win — e.g. bKash/Nagad/Rocket/Upay's own
          // provider always authorizes as PENDING with no ref (real
          // settlement normally goes through the customer-submitted
          // ManualPayment queue instead), but a staff member taking the
          // order over the phone may already have the transaction ID read
          // out to them and know it's been paid.
          status: dto.paymentStatus ?? authResult.status,
          amount: totalAmount,
          transactionRef: dto.transactionId ?? authResult.transactionRef,
          rawResponse: (authResult.rawResponse as object) ?? undefined,
        },
      });

      if (couponAmount.greaterThan(0) && dto.couponCode) {
        const discount = await tx.discount.findUnique({ where: { code: dto.couponCode } });
        if (discount) {
          await tx.discountRedemption.create({
            data: { discountId: discount.id, customerId: dto.customerId ?? null, orderId: created.id },
          });
          await tx.discount.update({ where: { id: discount.id }, data: { usedCount: { increment: 1 } } });
        }
      }

      return created;
    });

    this.events.emit(ORDER_CREATED_EVENT, {
      orderId: order.id,
      customerId: dto.customerId ?? null,
    } satisfies OrderCreatedEvent);

    // Task 5 propagated productTypeSnapshot: 'DIGITAL' into this path too
    // (New Order panel / Reorder) — a staff-created order with a digital
    // line needs the same locked entitlement real checkout creates, or a
    // later payment confirmation has nothing to unlock.
    await this.downloads.createForOrder(order.id);

    await this.orderEmails.sendOrderPlaced(order.id, adminId);
    await this.orderEmails.sendNewOrderAdminNotice(order.id);

    const full = await this.prisma.client.order.findUniqueOrThrow({
      where: { id: order.id },
      include: ORDER_INCLUDE,
    });
    return toOrderDto(full);
  }

  // Recreates a past order as a brand-new one — same customer/addresses/
  // items at their ORIGINAL prices (passed as unitPrice overrides, not
  // re-priced live) so "Reorder" reproduces what was actually charged, not
  // today's catalog price. Deliberately drops any coupon code (re-applying
  // a possibly-expired/exhausted/single-use code to a new order is more
  // likely to error or double-redeem than to help) and any per-line
  // discount baked into the old order's totals — those become a flat
  // discountAmount here, same simplification as OrdersService.updateAmounts.
  async reorder(orderId: number, adminId: number): Promise<OrderDto> {
    const order = await this.prisma.client.order.findUnique({
      where: { id: orderId },
      include: { items: true, addresses: true, payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!order) throw new BadRequestException('Order not found');

    const items = order.items.filter((i) => i.productId !== null);
    if (items.length === 0) {
      throw new BadRequestException("This order's products no longer exist and can't be reordered");
    }

    const shipping = order.addresses.find((a) => a.type === 'SHIPPING');
    if (!shipping) throw new BadRequestException('Order has no shipping address to reorder to');
    const billing = order.addresses.find((a) => a.type === 'BILLING') ?? shipping;

    const toAddressDto = (a: typeof shipping) => ({
      recipientName: a.recipientName,
      phone: a.phone,
      alternativePhone: a.alternativePhone ?? undefined,
      email: a.email ?? undefined,
      division: a.division,
      district: a.district,
      // area (thana) is required going forward, but a pre-existing order
      // from before that requirement could still have a null one on file —
      // fall back to '' rather than fail to compile; an empty thana will
      // still get caught by CheckoutAddressDto's own validation on reorder,
      // same as any other blank required field would.
      area: a.area ?? '',
      landmark: a.landmark ?? undefined,
      addressLine: a.addressLine,
      postCode: a.postCode ?? undefined,
    });

    return this.create(
      {
        customerId: order.customerId ?? undefined,
        channel: order.channel,
        shippingAddress: toAddressDto(shipping),
        billingAddress: toAddressDto(billing),
        items: items.map((i) => ({
          productId: i.productId!,
          variantId: i.variantId ?? undefined,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
        })),
        paymentProvider: order.payments[0]?.provider ?? 'COD',
        taxAmount: order.taxAmount.greaterThan(0) ? Number(order.taxAmount) : undefined,
        discountAmount: order.discountAmount.greaterThan(0) ? Number(order.discountAmount) : undefined,
        shippingAmount: order.shippingAmount.greaterThan(0) ? Number(order.shippingAmount) : undefined,
        customerNote: order.customerNote ?? undefined,
      },
      adminId,
    );
  }
}
