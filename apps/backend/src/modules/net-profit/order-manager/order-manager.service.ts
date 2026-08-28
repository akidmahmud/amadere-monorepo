import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CourierProviderName,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  RiskLevel,
  ShipmentStatus,
} from '@amader/db';
import { PaginatedResult, phoneLookupCandidates } from '@amader/shared';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { paginationArgs, toPaginatedResult } from '../../../common/pagination.util';
import { OrdersService } from '../../orders/orders.service';
import { ShipmentsService } from '../../courier/shipments.service';
import { BlockerService } from '../blocker/blocker.service';
import { OrderManagerQueryDto } from './dto/order-manager-query.dto';
import { BulkOrderActionDto } from './dto/bulk-order-action.dto';
import { OrderManagerLineDto, OrderManagerCourierAttempt, OrderManagerRowDto } from './order-manager.mapper';

interface RawOrderManagerRow {
  id: number;
  order_number: string;
  status: OrderStatus;
  total_amount: Prisma.Decimal;
  created_at: Date;
  recipient_name: string | null;
  phone: string | null;
  address_line: string | null;
  district: string | null;
  division: string | null;
  post_code: string | null;
  thumbnail_url: string | null;
  payment_provider: PaymentProvider | null;
  payment_status: PaymentStatus | null;
  courier_provider: CourierProviderName | null;
  shipment_id: number | null;
  courier_status: ShipmentStatus | null;
  courier_attempts: OrderManagerCourierAttempt[] | null;
  risk_level: RiskLevel;
  staff_note: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  assigned_admin_id: number | null;
  assigned_admin_name: string | null;
  items: OrderManagerLineDto[] | null;
  deleted_at: Date | null;
}

// A raw join (Order ⋈ latest Payment ⋈ latest Shipment ⋈ FraudCheck-by-phone)
// rather than N+1 Prisma queries or an in-memory risk filter after
// pagination — a `WHERE risk = 'HIGH'` filter has to happen *before*
// LIMIT/OFFSET or page 2 silently drops real rows. `order_addresses.phone`
// is stored in any of THREE live formats, confirmed against real data
// (grouped by length) — legacy local (01XXXXXXXXX, 11 chars, ~3000 rows),
// the current compact form (880XXXXXXXXXX, 13 chars, what every checkout
// writes since the @NormalizeBdPhone() rollout), and E.164 as-is
// (+8801XXXXXXXXX, 14 chars, ~50 rows from an earlier import) — while
// `fraud_checks.phone` is always `+8801XXXXXXXXX`. FRAUD_CHECK_JOIN builds
// the right `+88...` form from whichever length oa.phone actually has,
// instead of assuming it's always local (that assumption used to hold but
// broke silently for every order created after the rollout — this join
// returned RiskLevel.UNKNOWN for all of them).
const FRAUD_CHECK_JOIN = Prisma.sql`LEFT JOIN fraud_checks fc ON fc.phone = CASE length(oa.phone) WHEN 11 THEN '+88' || oa.phone WHEN 13 THEN '+' || oa.phone WHEN 14 THEN oa.phone ELSE NULL END`;

@Injectable()
export class OrderManagerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly shipments: ShipmentsService,
    private readonly blocker: BlockerService,
  ) {}

  // Shared by list() and statusCounts() — every filter except `status`
  // itself, so the counts reflect "how many would show for each status tab
  // given the other active filters" rather than an unfiltered global count.
  private buildConditions(query: OrderManagerQueryDto, includeStatus: boolean, deletedOnly = false): Prisma.Sql[] {
    const conditions: Prisma.Sql[] = [
      deletedOnly ? Prisma.sql`o.deleted_at IS NOT NULL` : Prisma.sql`o.deleted_at IS NULL`,
    ];
    if (includeStatus && query.status) conditions.push(Prisma.sql`o.status = ${query.status}::"OrderStatus"`);
    if (query.paymentProvider) conditions.push(Prisma.sql`p.provider = ${query.paymentProvider}::"PaymentProvider"`);
    if (query.courierProvider) conditions.push(Prisma.sql`s.provider = ${query.courierProvider}::"CourierProviderName"`);
    if (query.division) conditions.push(Prisma.sql`oa.division = ${query.division}`);
    if (query.risk) conditions.push(Prisma.sql`COALESCE(fc.risk_level, 'UNKNOWN'::"RiskLevel") = ${query.risk}::"RiskLevel"`);
    // "none" rather than an empty/absent value for unassigned: absent already
    // means "don't filter at all", so there would otherwise be no way to ask
    // for the pile nobody has picked up -- which is the main thing a manager
    // opens this filter to find.
    if (query.assignedAdminId === 'none') {
      conditions.push(Prisma.sql`o.assigned_admin_id IS NULL`);
    } else if (query.assignedAdminId) {
      const id = Number(query.assignedAdminId);
      if (Number.isInteger(id)) conditions.push(Prisma.sql`o.assigned_admin_id = ${id}`);
    }
    if (query.q) {
      const like = `%${query.q}%`;
      // Searches both stored phone formats (see FRAUD_CHECK_JOIN's comment
      // above) — phoneLookupCandidates falls back to [query.q] unchanged
      // for a non-phone-shaped search term, same as everywhere else.
      const phoneLikes = phoneLookupCandidates(query.q).map((c) => `%${c}%`);
      const phoneOr = Prisma.join(
        phoneLikes.map((p) => Prisma.sql`oa.phone ILIKE ${p}`),
        ' OR ',
      );
      // Also matches what was BOUGHT, not just who bought it: staff search by
      // SKU ("which orders contain FIBER-500?") and by product name at least
      // as often as by order number. EXISTS rather than a join, so an order
      // with three matching lines still returns one row.
      conditions.push(Prisma.sql`(
        o.order_number ILIKE ${like}
        OR ${phoneOr}
        OR oa.recipient_name ILIKE ${like}
        OR EXISTS (
          SELECT 1 FROM order_items oi_s
          WHERE oi_s.order_id = o.id
            AND (oi_s.sku_snapshot ILIKE ${like} OR oi_s.product_name_snapshot ILIKE ${like})
        )
      )`);
    }
    if (query.from) conditions.push(Prisma.sql`o.created_at >= ${new Date(query.from)}`);
    if (query.to) conditions.push(Prisma.sql`o.created_at <= ${new Date(query.to)}`);
    return conditions;
  }

  async statusCounts(query: OrderManagerQueryDto): Promise<Record<string, number>> {
    const conditions = this.buildConditions(query, false, false);
    const where = conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;

    const rows = await this.prisma.client.$queryRaw<{ status: OrderStatus; count: bigint }[]>`
      SELECT o.status, count(*)::bigint AS count
      FROM orders o
      LEFT JOIN order_addresses oa ON oa.order_id = o.id AND oa.type = 'SHIPPING'
      LEFT JOIN LATERAL (
        SELECT provider FROM payments WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
      ) p ON true
      LEFT JOIN LATERAL (
        SELECT provider FROM shipments WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
      ) s ON true
      ${FRAUD_CHECK_JOIN}
      ${where}
      GROUP BY o.status
    `;
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.status] = Number(r.count);
    return counts;
  }

  async list(query: OrderManagerQueryDto, deletedOnly = false): Promise<PaginatedResult<OrderManagerRowDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const conditions = this.buildConditions(query, true, deletedOnly);
    const where = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
    const orderBy = deletedOnly ? Prisma.sql`o.deleted_at DESC` : Prisma.sql`o.created_at DESC`;

    const rows = await this.prisma.client.$queryRaw<RawOrderManagerRow[]>`
      SELECT o.id, o.order_number, o.status, o.total_amount, o.created_at, o.staff_note,
             o.utm_source, o.utm_campaign, o.deleted_at,
             o.assigned_admin_id,
             NULLIF(TRIM(CONCAT(au.first_name, ' ', au.last_name)), '') AS assigned_admin_name,
             oa.recipient_name, oa.phone, oa.address_line, oa.district, oa.division, oa.post_code,
             thumb.url AS thumbnail_url,
             p.provider AS payment_provider,
             p.status AS payment_status,
             s.provider AS courier_provider,
             s.id AS shipment_id,
             s.status AS courier_status,
             ca.attempts AS courier_attempts,
             COALESCE(fc.risk_level, 'UNKNOWN'::"RiskLevel") AS risk_level,
             oi.items AS items
      FROM orders o
      LEFT JOIN order_addresses oa ON oa.order_id = o.id AND oa.type = 'SHIPPING'
      LEFT JOIN admin_users au ON au.id = o.assigned_admin_id
      LEFT JOIN LATERAL (
        SELECT provider, status FROM payments WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
      ) p ON true
      LEFT JOIN LATERAL (
        SELECT id, provider, status FROM shipments WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
      ) s ON true
      LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object('provider', provider, 'status', status, 'shipmentId', id)) AS attempts
        FROM (
          SELECT DISTINCT ON (provider) provider, status, id
          FROM shipments WHERE order_id = o.id
          ORDER BY provider, created_at DESC
        ) latest
      ) ca ON true
      -- Every line of the order, aggregated here rather than fetched per row
      -- afterwards: the table shows what was actually bought, and an order
      -- with four products must not cost four extra queries per page.
      -- Snapshots, not joins to products: an order shows what was sold, even
      -- after the product is renamed or deleted.
      LEFT JOIN LATERAL (
        SELECT json_agg(
                 json_build_object(
                   'name', product_name_snapshot,
                   'sku', sku_snapshot,
                   'quantity', quantity,
                   'unitPrice', unit_price
                 ) ORDER BY id
               ) AS items
        FROM order_items WHERE order_id = o.id
      ) oi ON true
      LEFT JOIN LATERAL (
        SELECT m.url
        FROM order_items oi
        JOIN product_media pm ON pm.product_id = oi.product_id AND pm.is_primary = true
        JOIN media m ON m.id = pm.media_id
        WHERE oi.order_id = o.id
        ORDER BY oi.id ASC
        LIMIT 1
      ) thumb ON true
      ${FRAUD_CHECK_JOIN}
      ${where}
      ORDER BY ${orderBy}
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
      ${FRAUD_CHECK_JOIN}
      ${where}
    `;

    const items: OrderManagerRowDto[] = rows.map((r) => ({
      id: r.id,
      orderNumber: r.order_number,
      status: r.status,
      totalAmount: r.total_amount.toString(),
      createdAt: r.created_at,
      recipientName: r.recipient_name,
      shippingPhone: r.phone,
      addressLine: r.address_line,
      district: r.district,
      division: r.division,
      postCode: r.post_code,
      thumbnailUrl: r.thumbnail_url,
      // ponytail: every order today comes through the storefront checkout —
      // no admin manual-order-creation flow exists yet, so this is a
      // constant rather than a real column. Revisit if that flow gets built.
      origin: 'Web',
      paymentProvider: r.payment_provider,
      paymentStatus: r.payment_status,
      courierProvider: r.courier_provider,
      shipmentId: r.shipment_id,
      courierStatus: r.courier_status,
      courierAttempts: r.courier_attempts ?? [],
      riskLevel: r.risk_level,
      staffNote: r.staff_note,
      utmSource: r.utm_source,
      utmCampaign: r.utm_campaign,
      assignedAdminId: r.assigned_admin_id,
      assignedAdminName: r.assigned_admin_name,
      // json_agg returns NULL, not [], for an order with no lines.
      items: (r.items ?? []).map((i) => ({ ...i, unitPrice: String(i.unitPrice) })),
      deletedAt: r.deleted_at,
    }));

    return toPaginatedResult(items, Number(countRows[0]?.count ?? 0), page, pageSize);
  }

  // Order Manager's "Deleted Orders" tab — same shape/filters as list(),
  // just flipped to the soft-deleted set (see buildConditions' deletedOnly).
  listDeleted(query: OrderManagerQueryDto): Promise<PaginatedResult<OrderManagerRowDto>> {
    return this.list(query, true);
  }

  async restore(orderId: number): Promise<void> {
    const order = await this.prisma.client.order.findUnique({ where: { id: orderId }, select: { deletedAt: true } });
    if (!order || order.deletedAt === null) throw new NotFoundException('Order not found in Deleted Orders');
    await this.prisma.client.order.update({ where: { id: orderId }, data: { deletedAt: null } });
  }

  async updateNote(orderId: number, note: string): Promise<void> {
    await this.prisma.client.order.update({
      where: { id: orderId },
      data: { staffNote: note || null },
    });
  }

  async assign(orderId: number, assignedAdminId: number | null): Promise<void> {
    await this.prisma.client.order.update({
      where: { id: orderId },
      data: { assignedAdminId },
    });
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
        } else if (dto.action === 'delete') {
          await this.prisma.client.order.update({ where: { id: orderId }, data: { deletedAt: new Date() } });
        } else if (dto.action === 'restore') {
          await this.restore(orderId);
        } else if (dto.action === 'assign') {
          await this.assign(orderId, dto.assignedAdminId ?? null);
        }
        succeeded.push(orderId);
      } catch (err) {
        failed.push({ orderId, error: err instanceof Error ? err.message : String(err) });
      }
    }

    return { succeeded, failed };
  }

  /**
   * CSV in the exact shape of the sheet the shop already keeps by hand —
   * columns and their order are fixed by that sheet, not chosen here.
   *
   * ONE ROW PER PRODUCT LINE, with the order-level fields repeated. An order
   * with four products becomes four rows, which is what makes the file
   * pivotable by product and is how the existing sheet is built. It also
   * means the money columns REPEAT: total per order, never a column sum.
   *
   * Quantity and price are expressed BY WEIGHT, matching the sheet: a 500 g
   * pack sold at 790 appears as qty 0.5 at 1580 per kg. Weight comes from the
   * variant, falling back to the product. When neither has one the line falls
   * back to plain units and unit price rather than inventing a conversion.
   */
  private async exportCsv(orderIds: number[]): Promise<string> {
    const orders = await this.prisma.client.order.findMany({
      where: { id: { in: orderIds } },
      include: {
        addresses: { where: { type: 'SHIPPING' } },
        payments: { take: 1, orderBy: { createdAt: 'desc' } },
        shipments: { take: 1, orderBy: { createdAt: 'desc' } },
        assignedAdmin: { select: { firstName: true, lastName: true } },
        items: {
          orderBy: { id: 'asc' },
          include: {
            variant: { select: { weightOverride: true } },
            product: { select: { shippableWeight: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const header = [
      'Date', 'Order Number', 'Source', 'Origin', 'Customer Name', 'Address',
      'Phone Number', 'Consignment ID', 'Product Name', 'Qty.', 'Price / kg',
      'Invoice Value', 'Delivery Charge', 'Discount', 'Grand Total',
      'Order Status', 'Payment Status', 'Payment Method', 'Notes / comment',
      'Assign', 'Division', 'District', 'Created At',
    ];

    // dd/mm/yyyy and hh:mm:ss, matching the sheet rather than ISO.
    const two = (n: number) => String(n).padStart(2, '0');
    const dmy = (d: Date) => two(d.getDate()) + '/' + two(d.getMonth() + 1) + '/' + d.getFullYear();
    const hms = (d: Date) => two(d.getHours()) + ':' + two(d.getMinutes()) + ':' + two(d.getSeconds());

    const rows: string[][] = [];
    for (const o of orders) {
      const addr = o.addresses[0];
      const payment = o.payments[0];
      const shipment = o.shipments[0];
      const assignee = o.assignedAdmin
        ? (String(o.assignedAdmin.firstName ?? '') + ' ' + String(o.assignedAdmin.lastName ?? '')).trim()
        : '';

      const shared = [
        dmy(o.createdAt),
        o.orderNumber,
        o.utmSource ?? '',
        o.channel,
        addr?.recipientName ?? '',
        addr?.addressLine ?? '',
        addr?.phone ?? '',
        shipment?.consignmentId ?? '',
      ];
      const tail = [
        o.shippingAmount.toString(),
        o.discountAmount.toString(),
        o.totalAmount.toString(),
        o.status,
        payment?.status ?? '',
        payment?.provider ?? '',
        o.staffNote ?? o.customerNote ?? '',
        assignee,
        addr?.division ?? '',
        addr?.district ?? '',
        dmy(o.createdAt) + ', ' + hms(o.createdAt),
      ];

      // An order with no lines still gets one row, so it cannot vanish from
      // an export the staff are reconciling against.
      const items = o.items.length > 0 ? o.items : [null];
      for (const item of items) {
        let qty = '';
        let pricePerKg = '';
        let invoice = '';
        if (item) {
          const unit = Number(item.unitPrice);
          invoice = (unit * item.quantity).toFixed(2);
          const weightKg = Number(item.variant?.weightOverride ?? item.product?.shippableWeight ?? 0);
          if (weightKg > 0) {
            qty = String(Number((weightKg * item.quantity).toFixed(3)));
            pricePerKg = (unit / weightKg).toFixed(2);
          } else {
            qty = String(item.quantity);
            pricePerKg = unit.toFixed(2);
          }
        }
        rows.push([
          ...shared,
          item?.productNameSnapshot ?? '',
          qty,
          pricePerKg,
          invoice,
          ...tail,
        ]);
      }
    }

    const esc = (v: string) => '"' + String(v).replace(/"/g, '""') + '"';
    return [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');
  }
}
