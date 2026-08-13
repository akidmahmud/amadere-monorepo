import {
  BadGatewayException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CourierProviderName, OrderStatus, Prisma, ShipmentStatus } from '@amader/db';
import { mapRawCourierStatus, phoneLookupCandidates } from '@amader/shared';
import { PaginatedResult } from '@amader/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  paginationArgs,
  toPaginatedResult,
} from '../../common/pagination.util';
import { OrdersService } from '../orders/orders.service';
import { OrderEmailsService } from '../order-emails/order-emails.service';
import { lockOrderRow } from '../orders/order-totals.util';
import { BalanceOutcome, CourierProvider } from './courier-provider.interface';
import { SteadfastCourierProvider } from './providers/steadfast-courier.provider';
import { PathaoCourierProvider } from './providers/pathao-courier.provider';
import { RedxCourierProvider } from './providers/redx-courier.provider';
import { UnconfiguredCourierProvider } from './providers/unconfigured-courier.provider';
import { ShippingChargeCalculator } from './shipping-charge.calculator';
import { CourierSettingsService } from './courier-settings.service';
import { DispatchShipmentDto } from './dto/dispatch-shipment.dto';
import { CancelShipmentDto } from './dto/cancel-shipment.dto';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import {
  ShipmentDto,
  ShipmentPerformanceDto,
  ShipmentQueueRowDto,
  SHIPMENT_INCLUDE,
  toShipmentDto,
} from './shipments.mapper';

const Decimal = Prisma.Decimal;

const ACTIVE_STATUSES = new Set<ShipmentStatus>([
  'PENDING',
  'DISPATCHED',
  'IN_TRANSIT',
]);

// Same set as OrdersService's ITEM_EDITABLE_STATUSES (private to that file,
// so not imported directly) — "order still holds a live, uncommitted stock
// reservation." A courier-status webhook should only auto-update orders
// still in one of these; anything already CANCELED/RETURNED/COMPLETED is
// left to whatever an admin already decided.
const ACTIVE_ORDER_STATUSES = new Set(['PENDING', 'CONFIRMED', 'PROCESSING', 'HOLD']);

// What a courier-reported shipment status should do to the parent Order.
// DELIVERED was the only one wired originally — RETURNED/CANCELED left the
// Order sitting wherever an admin last left it forever, same as DELIVERED
// used to, which meant a courier-returned order's stock reservation (only
// released when Order.status itself moves to CANCELED/RETURNED — see
// OrdersService's RELEASE_ON_CANCEL) could stay stuck indefinitely with
// nothing ever prompting an admin to notice. PARTIALLY_DELIVERED/
// IN_TRANSIT/DISPATCHED/PENDING deliberately have no entry — none of them
// map cleanly onto a terminal Order status the way "the courier confirms
// it's fully delivered/returned/canceled" does.
const ORDER_STATUS_ON_SHIPMENT_STATUS: Partial<Record<ShipmentStatus, OrderStatus>> = {
  DELIVERED: 'COMPLETED',
  RETURNED: 'RETURNED',
  CANCELED: 'CANCELED',
};

// Shared with the B12 migration script (packages/db/scripts/migrate/orders.ts)
// so the legacy-status mapping is defined once, not duplicated.
function mapRawStatus(raw: string): ShipmentStatus {
  return mapRawCourierStatus(raw);
}

@Injectable()
export class ShipmentsService {
  private readonly providers: Record<CourierProviderName, CourierProvider>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly charges: ShippingChargeCalculator,
    private readonly orders: OrdersService,
    private readonly courierSettings: CourierSettingsService,
    private readonly orderEmails: OrderEmailsService,
    steadfast: SteadfastCourierProvider,
    pathao: PathaoCourierProvider,
    redx: RedxCourierProvider,
  ) {
    this.providers = {
      STEADFAST: steadfast,
      PATHAO: pathao,
      REDX: redx,
      ECOURIER: new UnconfiguredCourierProvider('eCourier'),
    };
  }

  async dispatch(
    dto: DispatchShipmentDto,
    adminUserId: number,
  ): Promise<ShipmentDto> {
    const order = await this.prisma.client.order.findUnique({
      where: { id: dto.orderId },
      include: { items: true, addresses: true, payments: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const existingActive = await this.prisma.client.shipment.findFirst({
      where: { orderId: order.id, status: { in: [...ACTIVE_STATUSES] } },
    });
    if (existingActive)
      throw new ConflictException('Order already has an active shipment');

    const shippingAddress = order.addresses.find((a) => a.type === 'SHIPPING');
    if (!shippingAddress)
      throw new ConflictException('Order has no shipping address');

    const weight = await this.computeOrderWeight(order.items);
    const cost = await this.charges.calculate(weight, shippingAddress.division);
    // The courier's quoted cost can differ from whatever shippingAmount was
    // estimated at checkout — recompute totalAmount the same way
    // OrdersService.updateAmounts does, so it stays correct once dispatch
    // sets the real shippingAmount below, and so codAmount (what the
    // courier actually collects from the customer) isn't computed off a
    // stale total. This is an estimate for the courier API call below (COD
    // amount has to be quoted before dispatch) — the order's own stored
    // totalAmount is recomputed from a fresh, lock-protected read after the
    // dispatch call returns (see the `tx` block below), since a manual
    // shipping-fee edit or item change racing against this slow external
    // call could otherwise leave shippingAmount and totalAmount mismatched.
    const correctedTotalAmount = Decimal.max(
      order.subTotal.minus(order.discountAmount).plus(order.taxAmount).plus(order.codFee).plus(cost),
      new Decimal(0),
    );
    const pendingCod = order.payments.some(
      (p) => p.provider === 'COD' && p.status === 'PENDING',
    );
    const codAmount =
      dto.codAmountOverride !== undefined
        ? new Decimal(dto.codAmountOverride)
        : pendingCod
          ? correctedTotalAmount
          : new Decimal(0);

    // No `division` here — it used to add real information when it was a
    // distinct customer-picked field, but it's now always mechanically
    // derived from `district` (see toOrderAddressCreate), so appending it
    // too is pure noise — and a literal visible duplicate ("..., Dhaka,
    // Dhaka") for any of the 8 districts that share their divisional seat's
    // name (Dhaka, Chattogram, Rajshahi, Khulna, Barishal, Sylhet, Rangpur,
    // Mymensingh — the highest-order-volume districts, so far from a rare
    // edge case). Confirmed live: a real test order with district "Dhaka"
    // produced exactly this duplication before this fix.
    const addressParts = [
      shippingAddress.addressLine,
      shippingAddress.area,
      shippingAddress.landmark,
      shippingAddress.district,
      shippingAddress.postCode,
    ].filter(Boolean);

    const itemDescription = order.items
      .map((i) => `${i.skuSnapshot ?? i.productNameSnapshot} x${i.quantity}`)
      .join(', ');

    // Pathao's store doesn't vary per order — fall back to the configured
    // default (matches the plugin's own bulk-send fallback) so bulk-consign
    // from the Order Manager works without opening the per-order modal.
    // RedX's delivery area is genuinely recipient-dependent with no sane
    // default, so no fallback exists for it — a bulk RedX consign without
    // an explicit area just fails per-order with a clear message.
    let pathaoOptions = dto.pathao;
    if (dto.provider === 'PATHAO' && !pathaoOptions?.storeId) {
      const pathaoConfig = await this.courierSettings.getPathaoConfig();
      if (pathaoConfig.storeId) pathaoOptions = { ...pathaoOptions, storeId: pathaoConfig.storeId };
    }

    const result = await this.providers[dto.provider].createConsignment({
      invoiceNumber: order.orderNumber,
      recipientName: shippingAddress.recipientName,
      recipientPhone: shippingAddress.phone,
      alternativePhone: shippingAddress.alternativePhone ?? undefined,
      recipientEmail: shippingAddress.email ?? undefined,
      recipientAddress: addressParts.join(', '),
      codAmount,
      weightKg: weight,
      note: order.customerNote ?? undefined,
      itemDescription,
      deliveryType: 0,
      pathao: pathaoOptions,
      redx: dto.redx,
    });

    const shipment = await this.prisma.client.shipment.create({
      data: {
        orderId: order.id,
        provider: dto.provider,
        status: result.success ? 'DISPATCHED' : 'FAILED',
        consignmentId: result.consignmentId,
        trackingCode: result.trackingCode,
        cost,
        weight,
        codAmount,
        errorMessage: result.errorMessage,
        requestPayload: result.requestPayload as object,
        rawResponse: result.rawResponse as object,
        dispatchedAt: result.success ? new Date() : undefined,
        events: {
          create: {
            status: result.success ? 'DISPATCHED' : 'FAILED',
            note: result.success ? 'Consignment created' : result.errorMessage,
          },
        },
      },
      include: SHIPMENT_INCLUDE,
    });

    if (result.success) {
      await this.prisma.client.$transaction(async (tx) => {
        await lockOrderRow(tx, order.id);
        const fresh = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
        const finalTotalAmount = Decimal.max(
          fresh.subTotal.minus(fresh.discountAmount).plus(fresh.taxAmount).plus(fresh.codFee).plus(cost),
          new Decimal(0),
        );
        await tx.order.update({
          where: { id: order.id },
          data: { shippingAmount: cost, shippingMethod: dto.provider, totalAmount: finalTotalAmount },
        });
      });
      if (order.status === 'PENDING') {
        await this.orders.updateStatus(
          order.id,
          { status: 'PROCESSING', note: 'Courier dispatched' },
          adminUserId,
        );
      }
      await this.orderEmails.sendOrderShipped(order.id, shipment.trackingCode, adminUserId);
      return toShipmentDto(shipment);
    }

    // The audit row above is saved either way — the thrown error is just
    // what surfaces to the admin who tried to dispatch.
    throw new BadGatewayException(
      result.errorMessage ?? 'Courier dispatch failed',
    );
  }

  async track(id: number): Promise<ShipmentDto> {
    const shipment = await this.prisma.client.shipment.findUnique({
      where: { id },
    });
    if (!shipment) throw new NotFoundException('Shipment not found');
    if (!shipment.consignmentId)
      throw new ConflictException('Shipment has no consignment id to track');

    const result = await this.providers[shipment.provider].track(
      shipment.consignmentId,
    );
    const status = mapRawStatus(result.rawStatus);

    const updated = await this.prisma.client.shipment.update({
      where: { id },
      data: {
        status,
        rawResponse: result.rawResponse as object,
        deliveredAt: status === 'DELIVERED' ? new Date() : shipment.deliveredAt,
        events: {
          create: {
            status,
            note: `Tracked: ${result.rawStatus}`,
            rawPayload: result.rawResponse as object,
          },
        },
      },
      include: SHIPMENT_INCLUDE,
    });
    return toShipmentDto(updated);
  }

  async cancelOrReturn(
    id: number,
    dto: CancelShipmentDto,
  ): Promise<ShipmentDto> {
    const shipment = await this.prisma.client.shipment.findUnique({
      where: { id },
    });
    if (!shipment) throw new NotFoundException('Shipment not found');
    if (!shipment.consignmentId)
      throw new ConflictException('Shipment has no consignment id');

    const result = await this.providers[shipment.provider].cancelOrReturn(
      shipment.consignmentId,
      dto.reasonCode,
    );

    const updated = await this.prisma.client.shipment.update({
      where: { id },
      data: {
        status: 'CANCELED',
        returnReason: dto.reasonCode,
        rawResponse: result.rawResponse as object,
        events: {
          create: { status: 'CANCELED', note: result.note ?? dto.reasonCode },
        },
      },
      include: SHIPMENT_INCLUDE,
    });
    return toShipmentDto(updated);
  }

  // Manual override — distinct from track() (pulls from the courier's own
  // API) and the webhook handler (courier-pushed). Staff sometimes learn a
  // real status update by phone/portal before either of those catches up.
  async updateStatus(id: number, dto: UpdateShipmentStatusDto): Promise<ShipmentDto> {
    const shipment = await this.prisma.client.shipment.findUnique({ where: { id } });
    if (!shipment) throw new NotFoundException('Shipment not found');

    const updated = await this.prisma.client.shipment.update({
      where: { id },
      data: {
        status: dto.status,
        deliveredAt: dto.status === 'DELIVERED' ? new Date() : shipment.deliveredAt,
        events: {
          create: { status: dto.status, note: dto.note ?? 'Manually updated by staff' },
        },
      },
      include: SHIPMENT_INCLUDE,
    });
    return toShipmentDto(updated);
  }

  async adminList(
    page: number,
    pageSize: number,
    provider?: CourierProviderName,
  ): Promise<PaginatedResult<ShipmentDto>> {
    const where = provider ? { provider } : {};
    const [items, total] = await Promise.all([
      this.prisma.client.shipment.findMany({
        where,
        include: SHIPMENT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.shipment.count({ where }),
    ]);
    return toPaginatedResult(items.map(toShipmentDto), total, page, pageSize);
  }

  async adminGet(id: number): Promise<ShipmentDto> {
    const shipment = await this.prisma.client.shipment.findUnique({
      where: { id },
      include: SHIPMENT_INCLUDE,
    });
    if (!shipment) throw new NotFoundException('Shipment not found');
    return toShipmentDto(shipment);
  }

  // Order-centric dispatch queue (AGENTS.md — reference-site "SteadFast"
  // page parity): every order, whether or not it's ever been sent to a
  // courier, so staff can send un-dispatched ones from the same view where
  // they track already-dispatched ones. Deliberately a separate query from
  // adminList() above (which is shipment-record-centric) rather than a
  // shared helper — the two return fundamentally different row shapes.
  async adminQueue(page: number, pageSize: number, search?: string): Promise<PaginatedResult<ShipmentQueueRowDto>> {
    // Soft-deleted orders (Order Manager / this page's own "Deleted Orders"
    // tab, both writing/clearing Order.deletedAt) previously still showed up
    // here — this queue's own `where` never excluded them, unlike Order
    // Manager's own working-list query (`deleted_at IS NULL`).
    const where: Prisma.OrderWhereInput = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { orderNumber: { contains: search, mode: 'insensitive' } },
              {
                addresses: {
                  some: {
                    type: 'SHIPPING',
                    OR: [
                      ...phoneLookupCandidates(search).map((c) => ({ phone: { contains: c } })),
                      { recipientName: { contains: search, mode: 'insensitive' as const } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [orders, total] = await Promise.all([
      this.prisma.client.order.findMany({
        where,
        include: {
          addresses: { where: { type: 'SHIPPING' }, take: 1 },
          payments: { orderBy: { createdAt: 'desc' }, take: 1 },
          shipments: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.order.count({ where }),
    ]);

    const rows: ShipmentQueueRowDto[] = orders.map((o) => {
      const shippingAddress = o.addresses[0];
      const latestPayment = o.payments[0];
      const latestShipment = o.shipments[0];
      const pendingCod = latestPayment?.provider === 'COD' && latestPayment.status === 'PENDING';
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        createdAt: o.createdAt,
        status: o.status,
        recipientName: shippingAddress?.recipientName ?? null,
        shippingPhone: shippingAddress?.phone ?? null,
        totalAmount: o.totalAmount.toString(),
        pendingCodAmount: pendingCod ? o.totalAmount.toString() : null,
        shipment: latestShipment
          ? {
              id: latestShipment.id,
              provider: latestShipment.provider,
              status: latestShipment.status,
              consignmentId: latestShipment.consignmentId,
              trackingCode: latestShipment.trackingCode,
            }
          : null,
      };
    });

    return toPaginatedResult(rows, total, page, pageSize);
  }

  async getBalance(provider: CourierProviderName): Promise<BalanceOutcome> {
    const impl = this.providers[provider];
    if (!impl.getBalance) return { unavailable: true };
    return impl.getBalance();
  }

  // Same succeeded/failed error-collecting shape as Order Manager's bulk
  // "consign" action (which also just calls dispatch() per id) — a
  // dedicated endpoint here so the redesigned dispatch queue doesn't need
  // to round-trip through the Order Manager module for something that's
  // really this module's own responsibility.
  async dispatchBulk(
    orderIds: number[],
    provider: CourierProviderName,
    adminUserId: number,
  ): Promise<{ succeeded: number[]; failed: { orderId: number; error: string }[] }> {
    const succeeded: number[] = [];
    const failed: { orderId: number; error: string }[] = [];
    for (const orderId of orderIds) {
      try {
        await this.dispatch({ orderId, provider }, adminUserId);
        succeeded.push(orderId);
      } catch (err) {
        failed.push({ orderId, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return { succeeded, failed };
  }

  // Courier performance data (AGENTS.md §6): success/return rate, avg delivery time.
  async performance(
    provider?: CourierProviderName,
  ): Promise<ShipmentPerformanceDto> {
    const where = provider ? { provider } : {};
    const [total, delivered, returned, canceled, deliveredShipments] =
      await Promise.all([
        this.prisma.client.shipment.count({ where }),
        this.prisma.client.shipment.count({
          where: { ...where, status: 'DELIVERED' },
        }),
        this.prisma.client.shipment.count({
          where: { ...where, status: 'RETURNED' },
        }),
        this.prisma.client.shipment.count({
          where: { ...where, status: 'CANCELED' },
        }),
        this.prisma.client.shipment.findMany({
          where: {
            ...where,
            status: 'DELIVERED',
            dispatchedAt: { not: null },
            deliveredAt: { not: null },
          },
          select: { dispatchedAt: true, deliveredAt: true },
        }),
      ]);

    const avgDeliveryHours =
      deliveredShipments.length > 0
        ? deliveredShipments.reduce(
            (sum, s) =>
              sum + (s.deliveredAt!.getTime() - s.dispatchedAt!.getTime()),
            0,
          ) /
          deliveredShipments.length /
          (1000 * 60 * 60)
        : null;

    return {
      total,
      delivered,
      returned,
      canceled,
      successRate:
        total > 0 ? Number(((delivered / total) * 100).toFixed(2)) : null,
      returnRate:
        total > 0 ? (((returned + canceled) / total) * 100).toFixed(2) : null,
      avgDeliveryHours:
        avgDeliveryHours !== null ? Number(avgDeliveryHours.toFixed(1)) : null,
    };
  }

  async handleSteadfastWebhook(payload: {
    consignment_id: string;
    status: string;
    updated_at?: string;
  }) {
    return this.handleCourierWebhook('STEADFAST', String(payload.consignment_id), payload.status, payload);
  }

  // ADDENDUM §F — generic inbound-webhook handler shared by Steadfast
  // (above, unchanged path/behavior) and the new Pathao/RedX receivers in
  // CourierWebhooksController. Same shape either way: find the shipment by
  // provider+consignmentId, map the courier's raw status string through the
  // one shared mapping table, update the shipment, and log a real
  // ShipmentEvent with the raw payload attached for debugging.
  async handleCourierWebhook(
    provider: CourierProviderName,
    consignmentId: string,
    rawStatus: string,
    rawPayload: unknown,
  ): Promise<void> {
    const shipment = await this.prisma.client.shipment.findFirst({
      where: { provider, consignmentId },
    });
    if (!shipment)
      throw new NotFoundException('Shipment not found for this consignment');

    const status = mapRawStatus(rawStatus);
    await this.prisma.client.shipment.update({
      where: { id: shipment.id },
      data: {
        status,
        deliveredAt: status === 'DELIVERED' ? new Date() : shipment.deliveredAt,
        events: {
          create: {
            status,
            note: `Webhook: ${rawStatus}`,
            rawPayload: rawPayload as object,
          },
        },
      },
    });

    // Previously this only updated the Shipment sub-record — the parent
    // Order stayed wherever an admin last left it (often PROCESSING)
    // forever, even after the courier confirmed real-world delivery/return/
    // cancellation, leaving stock reservations uncommitted (DELIVERED) or
    // stuck reserved forever (RETURNED/CANCELED — see
    // ORDER_STATUS_ON_SHIPMENT_STATUS's own comment). Only fires while the
    // order is still in an active, pre-terminal status — an order an admin
    // already moved to CANCELED/RETURNED/COMPLETED themselves is left
    // alone, same guard OrdersService.updateStatus itself uses to decide
    // whether a live reservation still exists to commit/release.
    const orderStatus = ORDER_STATUS_ON_SHIPMENT_STATUS[status];
    if (orderStatus) {
      const order = await this.prisma.client.order.findUnique({
        where: { id: shipment.orderId },
        select: { id: true, status: true },
      });
      if (order && ACTIVE_ORDER_STATUSES.has(order.status)) {
        await this.orders.updateStatus(
          order.id,
          { status: orderStatus, note: `Auto-updated — ${provider} reported ${rawStatus}` },
          null,
        );
      }
    }
  }

  private async computeOrderWeight(
    items: {
      productId: number | null;
      variantId: number | null;
      quantity: number;
    }[],
  ): Promise<Prisma.Decimal> {
    let total = new Decimal(0);
    for (const item of items) {
      if (item.variantId) {
        const variant = await this.prisma.client.productVariant.findUnique({
          where: { id: item.variantId },
          select: {
            weightOverride: true,
            product: { select: { shippableWeight: true } },
          },
        });
        const weight =
          variant?.weightOverride ?? variant?.product.shippableWeight;
        if (weight) total = total.plus(weight.times(item.quantity));
      } else if (item.productId) {
        const product = await this.prisma.client.product.findUnique({
          where: { id: item.productId },
          select: { shippableWeight: true },
        });
        if (product?.shippableWeight)
          total = total.plus(product.shippableWeight.times(item.quantity));
      }
    }
    return total;
  }
}
