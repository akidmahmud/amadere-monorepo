import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CourierProviderName,
  OrderStatus,
  PaymentProvider,
  Prisma,
  RiskLevel,
} from '@amader/db';
import { PaginatedResult } from '@amader/shared';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { paginationArgs, toPaginatedResult } from '../../../common/pagination.util';
import { OrdersService } from '../../orders/orders.service';
import { ShipmentsService } from '../../courier/shipments.service';
import { BlockerService } from '../blocker/blocker.service';
import { OrderManagerQueryDto } from './dto/order-manager-query.dto';
import { BulkOrderActionDto } from './dto/bulk-order-action.dto';
import { OrderManagerRowDto } from './order-manager.mapper';

interface RawOrderManagerRow {
  id: number;
  order_number: string;
  status: OrderStatus;
  total_amount: Prisma.Decimal;
  created_at: Date;
  phone: string | null;
  division: string | null;
  payment_provider: PaymentProvider | null;
  courier_provider: CourierProviderName | null;
  risk_level: RiskLevel;
}

// A raw join (Order ⋈ latest Payment ⋈ latest Shipment ⋈ FraudCheck-by-phone)
// rather than N+1 Prisma queries or an in-memory risk filter after
// pagination — a `WHERE risk = 'HIGH'` filter has to happen *before*
// LIMIT/OFFSET or page 2 silently drops real rows. Phone join assumes the
// local-11-digit format confirmed against real `order_addresses.phone`
// (same assumption `normalizeBdPhone` encodes) rather than re-normalizing
// row-by-row in SQL.
@Injectable()
export class OrderManagerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly shipments: ShipmentsService,
    private readonly blocker: BlockerService,
  ) {}

  async list(query: OrderManagerQueryDto): Promise<PaginatedResult<OrderManagerRowDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const conditions: Prisma.Sql[] = [];
    if (query.status) conditions.push(Prisma.sql`o.status = ${query.status}::"OrderStatus"`);
    if (query.paymentProvider) conditions.push(Prisma.sql`p.provider = ${query.paymentProvider}::"PaymentProvider"`);
    if (query.courierProvider) conditions.push(Prisma.sql`s.provider = ${query.courierProvider}::"CourierProviderName"`);
    if (query.division) conditions.push(Prisma.sql`oa.division = ${query.division}`);
    if (query.risk) conditions.push(Prisma.sql`COALESCE(fc.risk_level, 'UNKNOWN'::"RiskLevel") = ${query.risk}::"RiskLevel"`);

    const where = conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;

    const rows = await this.prisma.client.$queryRaw<RawOrderManagerRow[]>`
      SELECT o.id, o.order_number, o.status, o.total_amount, o.created_at,
             oa.phone, oa.division,
             p.provider AS payment_provider,
             s.provider AS courier_provider,
             COALESCE(fc.risk_level, 'UNKNOWN'::"RiskLevel") AS risk_level
      FROM orders o
      LEFT JOIN order_addresses oa ON oa.order_id = o.id AND oa.type = 'SHIPPING'
      LEFT JOIN LATERAL (
        SELECT provider FROM payments WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
      ) p ON true
      LEFT JOIN LATERAL (
        SELECT provider FROM shipments WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
      ) s ON true
      LEFT JOIN fraud_checks fc ON fc.phone = '+88' || oa.phone
      ${where}
      ORDER BY o.created_at DESC
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `;

    const countRows = await this.prisma.client.$queryRaw<{ count: bigint }[]>`
      SELECT count(*)::bigint AS count
      FROM orders o
      LEFT JOIN order_addresses oa ON oa.order_id = o.id AND oa.type = 'SHIPPING'
      LEFT JOIN LATERAL (
        SELECT provider FROM payments WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
      ) p ON true
      LEFT JOIN LATERAL (
        SELECT provider FROM shipments WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
      ) s ON true
      LEFT JOIN fraud_checks fc ON fc.phone = '+88' || oa.phone
      ${where}
    `;

    const items: OrderManagerRowDto[] = rows.map((r) => ({
      id: r.id,
      orderNumber: r.order_number,
      status: r.status,
      totalAmount: r.total_amount.toString(),
      createdAt: r.created_at,
      shippingPhone: r.phone,
      division: r.division,
      paymentProvider: r.payment_provider,
      courierProvider: r.courier_provider,
      riskLevel: r.risk_level,
    }));

    return toPaginatedResult(items, Number(countRows[0]?.count ?? 0), page, pageSize);
  }

  async bulkAction(
    dto: BulkOrderActionDto,
    adminUserId: number,
  ): Promise<{ succeeded: number[]; failed: { orderId: number; error: string }[]; csv?: string }> {
    const succeeded: number[] = [];
    const failed: { orderId: number; error: string }[] = [];

    if (dto.action === 'export') {
      const csv = await this.exportCsv(dto.orderIds);
      return { succeeded: dto.orderIds, failed: [], csv };
    }

    for (const orderId of dto.orderIds) {
      try {
        if (dto.action === 'consign') {
          if (!dto.courierProvider) throw new BadRequestException('courierProvider is required for consign');
          await this.shipments.dispatch({ orderId, provider: dto.courierProvider }, adminUserId);
        } else if (dto.action === 'hold') {
          await this.orders.updateStatus(orderId, { status: 'HOLD', note: 'Held via Order Manager' }, adminUserId);
        } else if (dto.action === 'block') {
          const order = await this.prisma.client.order.findUnique({
            where: { id: orderId },
            include: { addresses: { where: { type: 'SHIPPING' } } },
          });
          const phone = order?.addresses[0]?.phone;
          if (!phone) throw new NotFoundException('Order has no shipping phone to block');
          await this.blocker.create({ type: 'PHONE', value: phone, reason: `Blocked from order #${orderId}` }, adminUserId);
        }
        succeeded.push(orderId);
      } catch (err) {
        failed.push({ orderId, error: err instanceof Error ? err.message : String(err) });
      }
    }

    return { succeeded, failed };
  }

  private async exportCsv(orderIds: number[]): Promise<string> {
    const orders = await this.prisma.client.order.findMany({
      where: { id: { in: orderIds } },
      include: { addresses: { where: { type: 'SHIPPING' } }, payments: { take: 1, orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });
    const header = 'Order Number,Status,Total,Payment,Phone,Division,District,Created At';
    const lines = orders.map((o) => {
      const addr = o.addresses[0];
      const payment = o.payments[0];
      return [
        o.orderNumber,
        o.status,
        o.totalAmount.toString(),
        payment?.provider ?? '',
        addr?.phone ?? '',
        addr?.division ?? '',
        addr?.district ?? '',
        o.createdAt.toISOString(),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',');
    });
    return [header, ...lines].join('\n');
  }
}
