import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderAddressType, Prisma } from '@amader/db';
import { PaginatedResult, phoneLookupCandidates } from '@amader/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  paginationArgs,
  toPaginatedResult,
} from '../../common/pagination.util';
import { PaymentsService } from '../payments/payments.service';
import { PricingService } from '../cart/pricing.service';
import { SmtpEmailProvider } from '../net-profit/cart-campaigns/providers/smtp-email.provider';
import { ORDER_INCLUDE, OrderDto, toOrderDto } from './orders.mapper';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { RefundOrderDto } from './dto/refund-order.dto';
import { TrackOrderDto } from './dto/track-order.dto';
import { AddOrderItemDto } from './dto/add-order-item.dto';
import { UpdateOrderItemDto } from './dto/update-order-item.dto';
import { UpdateOrderDetailsDto } from './dto/update-order-details.dto';
import { UpdateOrderPaymentDto } from './dto/update-order-payment.dto';
import { UpdateOrderAmountsDto } from './dto/update-order-amounts.dto';
import { reserveStock, releaseStock } from './stock-reservation.util';
import { lockOrderRow } from './order-totals.util';
import {
  ORDER_STATUS_CHANGED_EVENT,
  OrderStatusChangedEvent,
} from './orders.events';

const Decimal = Prisma.Decimal;

// Statuses that release/commit the stock reservation held at checkout.
// RETURNED and PARTIALLY_RETURNED are included deliberately — an order that
// never reached COMPLETED still holds a live reservation (reservedStock),
// and one that did reach COMPLETED had its stock actually decremented, so a
// return needs to restock rather than release (see updateStatus).
// PARTIALLY_RETURNED is treated the same as a full RETURNED (restock/release
// everything) rather than doing nothing: ponytail — this codebase has no
// per-item return-quantity tracking (OrderItem.restockedQuantity is a schema
// column nothing writes to), so a true partial restock can't know how much
// to move; upgrade path is a real returns line-item model, not a guess here,
// but leaving stock untouched entirely (the old behavior) was strictly worse
// than restocking the full quantity.
const RELEASE_ON_CANCEL = new Set(['CANCELED', 'RETURNED', 'PARTIALLY_RETURNED']);
const COMMIT_ON_COMPLETE = new Set(['COMPLETED']);

// Line items can only be edited before stock has been committed/released —
// once an order is COMPLETED (stock decremented for real) or in a terminal
// state (CANCELED/RETURNED/PARTIALLY_RETURNED), further edits here would
// desync the reservation accounting those transitions already settled.
const ITEM_EDITABLE_STATUSES = new Set(['PENDING', 'CONFIRMED', 'PROCESSING', 'HOLD']);

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly pricing: PricingService,
    private readonly email: SmtpEmailProvider,
    private readonly events: EventEmitter2,
  ) {}

  async adminList(
    page: number,
    pageSize: number,
    status?: string,
  ): Promise<PaginatedResult<OrderDto>> {
    const where = status ? { status: status as never } : {};
    const [items, total] = await Promise.all([
      this.prisma.client.order.findMany({
        where,
        include: ORDER_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.order.count({ where }),
    ]);
    return toPaginatedResult(items.map(toOrderDto), total, page, pageSize);
  }

  async adminGet(id: number): Promise<OrderDto> {
    const order = await this.prisma.client.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Order not found');
    return toOrderDto(order);
  }

  async updateStatus(
    id: number,
    dto: UpdateOrderStatusDto,
    // null for system-triggered transitions (e.g. a courier webhook
    // auto-completing delivered orders) — same nullable convention the
    // webhook controllers already use for audit-log entries.
    adminUserId: number | null,
  ): Promise<OrderDto> {
    const order = await this.prisma.client.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === dto.status) return this.reload(id);

    // `completedAt` is a one-way marker — it's only ever set (never cleared)
    // by this same method below, regardless of what status the order moves
    // to afterward. That makes it a far more reliable "has this order's
    // stock ever actually been committed/decremented" signal than the
    // order's CURRENT status label: the admin status dropdown allows any
    // transition (including backward ones like COMPLETED → PROCESSING),
    // and a naive `order.status === 'COMPLETED'` / `ITEM_EDITABLE_STATUSES`
    // check breaks the moment an order takes a detour through an active
    // status after already being completed once — confirmed live: PENDING →
    // COMPLETED → PROCESSING → CANCELED left reservedStock at -1 because the
    // CANCELED branch saw status='PROCESSING' and (wrongly) tried to release
    // a reservation that had already been consumed.
    const wasEverCompleted = order.completedAt !== null;

    await this.prisma.client.$transaction(async (tx) => {
      // Guarded on the FROM status too, not just the TO status — without
      // this, bouncing between two release statuses (e.g. RETURNED then
      // CANCELED) would release/restock the same order twice.
      if (RELEASE_ON_CANCEL.has(dto.status) && !RELEASE_ON_CANCEL.has(order.status)) {
        if (wasEverCompleted) {
          // Stock was already committed (decremented for real) at some
          // point in this order's history — the physical items are coming
          // back, so restock instead of releasing a reservation that no
          // longer exists.
          await this.restockReturnedItems(tx, order.items);
        } else {
          await this.releaseReservations(tx, order.items);
        }
      }
      if (COMMIT_ON_COMPLETE.has(dto.status)) {
        if (wasEverCompleted) {
          // Re-completing (directly or via a detour through another active
          // status) after an earlier CANCELED/RETURNED — that reservation
          // was already resolved, so there's nothing left in reservedStock
          // to consume. Decrementing it again would drive it negative,
          // making every later availability check (stock - reservedStock)
          // overstate what's actually sellable. Only stock should move.
          await this.decrementStockOnly(tx, order.items);
        } else {
          // Genuinely the first completion — a live reservation still
          // exists, so consume it for real (reservedStock AND stock).
          await this.commitReservations(tx, order.items);
        }
      }

      await tx.order.update({
        where: { id },
        data: {
          status: dto.status,
          confirmedAt: dto.status === 'PROCESSING' ? new Date() : undefined,
          completedAt: dto.status === 'COMPLETED' ? new Date() : undefined,
          canceledAt: dto.status === 'CANCELED' ? new Date() : undefined,
          // A real staff action (not a courier webhook/system transition)
          // takes ownership of the order — same "whoever last touched it"
          // reassignment as the Order Manager's own assign action.
          assignedAdminId: adminUserId !== null ? adminUserId : undefined,
        },
      });
      await tx.orderStatusHistory.create({
        data: { orderId: id, status: dto.status, note: dto.note, adminUserId },
      });
    });

    this.events.emit(ORDER_STATUS_CHANGED_EVENT, {
      orderId: id,
      from: order.status,
      to: dto.status,
    } satisfies OrderStatusChangedEvent);

    return this.reload(id);
  }

  async refund(
    id: number,
    dto: RefundOrderDto,
    adminUserId: number,
  ): Promise<OrderDto> {
    const order = await this.prisma.client.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (dto.amount > Number(order.totalAmount)) {
      throw new BadRequestException('Refund amount exceeds order total');
    }

    await this.payments.refund(id, new Prisma.Decimal(dto.amount));
    await this.prisma.client.orderStatusHistory.create({
      data: {
        orderId: id,
        status: order.status,
        note: dto.reason
          ? `Refunded ${dto.amount}: ${dto.reason}`
          : `Refunded ${dto.amount}`,
        adminUserId,
      },
    });
    return this.reload(id);
  }

  private async assertItemsEditable(orderId: number): Promise<{ id: number; status: string }> {
    const order = await this.prisma.client.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (!ITEM_EDITABLE_STATUSES.has(order.status)) {
      throw new BadRequestException(
        `Items can't be edited once an order is ${order.status.toLowerCase()}`,
      );
    }
    return order;
  }

  // Re-sums the current item list rather than re-running full checkout
  // pricing/coupon validation — discountAmount/taxAmount/shippingAmount are
  // deliberately held fixed across item edits (ponytail: re-validating
  // coupon eligibility, e.g. minOrderAmount, on every quantity tweak is a
  // materially bigger feature; revisit if staff report stale discounts).
  private async recomputeTotals(tx: Prisma.TransactionClient, orderId: number): Promise<void> {
    await lockOrderRow(tx, orderId);
    const [order, items] = await Promise.all([
      tx.order.findUniqueOrThrow({ where: { id: orderId } }),
      tx.orderItem.findMany({ where: { orderId } }),
    ]);
    const subTotal = items.reduce(
      (sum, i) => sum.plus(i.unitPrice.times(i.quantity)),
      new Decimal(0),
    );
    const totalAmount = Decimal.max(
      subTotal.minus(order.discountAmount).plus(order.taxAmount).plus(order.codFee).plus(order.shippingAmount),
      new Decimal(0),
    );
    await tx.order.update({ where: { id: orderId }, data: { subTotal, totalAmount } });
  }

  async addItem(orderId: number, dto: AddOrderItemDto): Promise<OrderDto> {
    await this.assertItemsEditable(orderId);

    const product = await this.prisma.client.product.findUnique({
      where: { id: dto.productId },
      include: { translations: { where: { locale: 'EN' }, take: 1 }, variants: true },
    });
    if (!product) throw new BadRequestException(`Product #${dto.productId} not found`);
    if (dto.variantId && !product.variants.some((v) => v.id === dto.variantId)) {
      throw new BadRequestException(`Variant #${dto.variantId} does not belong to product #${dto.productId}`);
    }

    const [priced] = await this.pricing.priceLines([
      { productId: dto.productId, variantId: dto.variantId ?? null, quantity: dto.quantity },
    ]);
    const unitPrice = dto.unitPrice !== undefined ? new Decimal(dto.unitPrice) : priced.unitPrice;
    const variant = dto.variantId ? product.variants.find((v) => v.id === dto.variantId) : undefined;

    await this.prisma.client.$transaction(async (tx) => {
      await reserveStock(tx, dto.productId, dto.variantId ?? null, dto.quantity);
      await tx.orderItem.create({
        data: {
          orderId,
          productId: dto.productId,
          variantId: dto.variantId ?? null,
          productNameSnapshot: product.translations[0]?.name ?? product.slug,
          skuSnapshot: variant?.sku ?? product.sku,
          unitPrice,
          quantity: dto.quantity,
        },
      });
      await this.recomputeTotals(tx, orderId);
    });

    return this.reload(orderId);
  }

  async updateItemQuantity(orderId: number, itemId: number, dto: UpdateOrderItemDto): Promise<OrderDto> {
    await this.assertItemsEditable(orderId);
    const item = await this.prisma.client.orderItem.findUnique({ where: { id: itemId } });
    if (!item || item.orderId !== orderId) throw new NotFoundException('Order item not found');

    const delta = dto.quantity - item.quantity;
    await this.prisma.client.$transaction(async (tx) => {
      // productId is only null for a line whose product was later deleted
      // (schema's onDelete: SetNull) — nothing left to reserve against.
      if (item.productId) {
        if (delta > 0) {
          await reserveStock(tx, item.productId, item.variantId, delta);
        } else if (delta < 0) {
          await releaseStock(tx, item.productId, item.variantId, -delta);
        }
      }
      await tx.orderItem.update({ where: { id: itemId }, data: { quantity: dto.quantity } });
      await this.recomputeTotals(tx, orderId);
    });

    return this.reload(orderId);
  }

  async removeItem(orderId: number, itemId: number): Promise<OrderDto> {
    await this.assertItemsEditable(orderId);
    const [item, itemCount] = await Promise.all([
      this.prisma.client.orderItem.findUnique({ where: { id: itemId } }),
      this.prisma.client.orderItem.count({ where: { orderId } }),
    ]);
    if (!item || item.orderId !== orderId) throw new NotFoundException('Order item not found');
    if (itemCount <= 1) throw new BadRequestException('An order must have at least one item');

    await this.prisma.client.$transaction(async (tx) => {
      if (item.productId) {
        await releaseStock(tx, item.productId, item.variantId, item.quantity);
      }
      await tx.orderItem.delete({ where: { id: itemId } });
      await this.recomputeTotals(tx, orderId);
    });

    return this.reload(orderId);
  }

  async updateDetails(orderId: number, dto: UpdateOrderDetailsDto): Promise<OrderDto> {
    const order = await this.prisma.client.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    await this.prisma.client.$transaction(async (tx) => {
      if (dto.channel !== undefined || dto.utmSource !== undefined) {
        await tx.order.update({
          where: { id: orderId },
          data: { channel: dto.channel, utmSource: dto.utmSource },
        });
      }
      if (dto.division !== undefined || dto.phone !== undefined || dto.addressLine !== undefined) {
        await tx.orderAddress.updateMany({
          where: { orderId, type: OrderAddressType.SHIPPING },
          data: { division: dto.division, phone: dto.phone, addressLine: dto.addressLine },
        });
      }
    });

    return this.reload(orderId);
  }

  async updatePayment(orderId: number, dto: UpdateOrderPaymentDto): Promise<OrderDto> {
    const latest = await this.prisma.client.payment.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
    if (!latest) throw new NotFoundException('Order has no payment record');

    await this.prisma.client.payment.update({
      where: { id: latest.id },
      data: { provider: dto.provider, status: dto.status },
    });

    return this.reload(orderId);
  }

  async updateAmounts(orderId: number, dto: UpdateOrderAmountsDto): Promise<OrderDto> {
    await this.prisma.client.$transaction(async (tx) => {
      await lockOrderRow(tx, orderId);
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Order not found');

      const discountAmount = dto.discountAmount !== undefined ? new Decimal(dto.discountAmount) : order.discountAmount;
      const shippingAmount = dto.shippingAmount !== undefined ? new Decimal(dto.shippingAmount) : order.shippingAmount;
      const totalAmount = Decimal.max(
        order.subTotal.minus(discountAmount).plus(order.taxAmount).plus(order.codFee).plus(shippingAmount),
        new Decimal(0),
      );

      await tx.order.update({
        where: { id: orderId },
        data: {
          discountAmount,
          shippingAmount,
          totalAmount,
          couponCode: dto.couponCode !== undefined ? dto.couponCode || null : undefined,
        },
      });
    });

    return this.reload(orderId);
  }

  // Best-effort — SmtpEmailProvider never throws (see its own comments), so
  // this always resolves; the result is only used to decide what to write
  // into history, not to fail whatever triggered it (checkout, manual
  // order creation, or the admin's explicit "Resend" click).
  async sendConfirmationEmail(orderId: number, adminUserId?: number): Promise<{ sent: boolean; reason?: string }> {
    const order = await this.prisma.client.order.findUnique({
      where: { id: orderId },
      include: { addresses: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const shipping = order.addresses.find((a) => a.type === 'SHIPPING');
    const to = shipping?.email;
    if (!to) {
      await this.prisma.client.orderStatusHistory.create({
        data: { orderId, status: order.status, note: 'Email confirmation not sent — no email on file', adminUserId },
      });
      return { sent: false, reason: 'No email on file' };
    }

    const result = await this.email.send(
      to,
      `Your order ${order.orderNumber} is confirmed`,
      `Thank you for your order ${order.orderNumber}. Total: ${order.currency} ${order.totalAmount.toString()}. We'll notify you when it ships.`,
    );

    await this.prisma.client.orderStatusHistory.create({
      data: {
        orderId,
        status: order.status,
        note: result.failed ? `Email confirmation failed: ${result.error}` : 'The email confirmation was sent to customer',
        adminUserId,
      },
    });

    return { sent: !result.failed, reason: result.error };
  }

  async myList(
    customerId: number,
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<OrderDto>> {
    const where = { customerId };
    const [items, total] = await Promise.all([
      this.prisma.client.order.findMany({
        where,
        include: ORDER_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.order.count({ where }),
    ]);
    return toPaginatedResult(items.map(toOrderDto), total, page, pageSize);
  }

  async myGet(customerId: number, orderNumber: string): Promise<OrderDto> {
    const order = await this.prisma.client.order.findUnique({
      where: { orderNumber },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.customerId !== customerId)
      throw new ForbiddenException('This order does not belong to you');
    return toOrderDto(order);
  }

  // Guest tracking: orderNumber + shipping phone, no account required.
  async track(dto: TrackOrderDto): Promise<OrderDto> {
    const order = await this.prisma.client.order.findUnique({
      where: { orderNumber: dto.orderNumber },
      include: { ...ORDER_INCLUDE, addresses: true },
    });
    const candidates = phoneLookupCandidates(dto.phone);
    if (!order || !order.addresses.some((a) => candidates.includes(a.phone))) {
      throw new NotFoundException('Order not found');
    }
    return toOrderDto(order);
  }

  private async reload(id: number) {
    const order = await this.prisma.client.order.findUniqueOrThrow({
      where: { id },
      include: ORDER_INCLUDE,
    });
    return toOrderDto(order);
  }

  private async releaseReservations(
    tx: Prisma.TransactionClient,
    items: {
      productId: number | null;
      variantId: number | null;
      quantity: number;
    }[],
  ): Promise<void> {
    for (const item of items) {
      if (item.variantId) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { reservedStock: { decrement: item.quantity } },
        });
      } else if (item.productId) {
        await tx.product.update({
          where: { id: item.productId },
          data: { reservedStock: { decrement: item.quantity } },
        });
      }
    }
  }

  // Counterpart to commitReservations — a return after COMPLETED puts
  // physical stock back on the shelf (reservedStock is already 0 for these
  // items; commitReservations zeroed it when the sale completed).
  private async restockReturnedItems(
    tx: Prisma.TransactionClient,
    items: {
      productId: number | null;
      variantId: number | null;
      quantity: number;
    }[],
  ): Promise<void> {
    for (const item of items) {
      if (item.variantId) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      } else if (item.productId) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }
  }

  // Counterpart to restockReturnedItems — re-completing an order whose
  // reservation was already resolved by an earlier CANCELED/RETURNED
  // transition. Only stock moves; there's no live reservedStock left to
  // consume (see updateStatus).
  private async decrementStockOnly(
    tx: Prisma.TransactionClient,
    items: {
      productId: number | null;
      variantId: number | null;
      quantity: number;
    }[],
  ): Promise<void> {
    for (const item of items) {
      if (item.variantId) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { decrement: item.quantity } },
        });
      } else if (item.productId) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }
    }
  }

  private async commitReservations(
    tx: Prisma.TransactionClient,
    items: {
      productId: number | null;
      variantId: number | null;
      quantity: number;
    }[],
  ): Promise<void> {
    for (const item of items) {
      if (item.variantId) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: {
            reservedStock: { decrement: item.quantity },
            stock: { decrement: item.quantity },
          },
        });
      } else if (item.productId) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            reservedStock: { decrement: item.quantity },
            stock: { decrement: item.quantity },
          },
        });
      }
    }
  }
}
