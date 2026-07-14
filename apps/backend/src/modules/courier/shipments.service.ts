import {
  BadGatewayException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CourierProviderName, Prisma, ShipmentStatus } from '@amader/db';
import { mapRawCourierStatus } from '@amader/shared';
import { PaginatedResult } from '@amader/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  paginationArgs,
  toPaginatedResult,
} from '../../common/pagination.util';
import { OrdersService } from '../orders/orders.service';
import { CourierProvider } from './courier-provider.interface';
import { SteadfastCourierProvider } from './providers/steadfast-courier.provider';
import { UnconfiguredCourierProvider } from './providers/unconfigured-courier.provider';
import { ShippingChargeCalculator } from './shipping-charge.calculator';
import { DispatchShipmentDto } from './dto/dispatch-shipment.dto';
import { CancelShipmentDto } from './dto/cancel-shipment.dto';
import {
  ShipmentDto,
  ShipmentPerformanceDto,
  SHIPMENT_INCLUDE,
  toShipmentDto,
} from './shipments.mapper';

const Decimal = Prisma.Decimal;

const ACTIVE_STATUSES = new Set<ShipmentStatus>([
  'PENDING',
  'DISPATCHED',
  'IN_TRANSIT',
]);

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
    steadfast: SteadfastCourierProvider,
  ) {
    this.providers = {
      STEADFAST: steadfast,
      PATHAO: new UnconfiguredCourierProvider('Pathao'),
      REDX: new UnconfiguredCourierProvider('RedX'),
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
    const pendingCod = order.payments.some(
      (p) => p.provider === 'COD' && p.status === 'PENDING',
    );
    const codAmount = pendingCod ? order.totalAmount : new Decimal(0);
    const cost = await this.charges.calculate(weight, shippingAddress.division);

    const addressParts = [
      shippingAddress.addressLine,
      shippingAddress.area,
      shippingAddress.landmark,
      shippingAddress.district,
      shippingAddress.division,
      shippingAddress.postCode,
    ].filter(Boolean);

    const itemDescription = order.items
      .map((i) => `${i.skuSnapshot ?? i.productNameSnapshot} x${i.quantity}`)
      .join(', ');

    const result = await this.providers[dto.provider].createConsignment({
      invoiceNumber: order.orderNumber,
      recipientName: shippingAddress.recipientName,
      recipientPhone: shippingAddress.phone,
      recipientAddress: addressParts.join(', '),
      codAmount,
      weightKg: weight,
      note: order.customerNote ?? undefined,
      itemDescription,
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
      await this.prisma.client.order.update({
        where: { id: order.id },
        data: { shippingAmount: cost, shippingMethod: dto.provider },
      });
      if (order.status === 'PENDING') {
        await this.orders.updateStatus(
          order.id,
          { status: 'PROCESSING', note: 'Courier dispatched' },
          adminUserId,
        );
      }
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
