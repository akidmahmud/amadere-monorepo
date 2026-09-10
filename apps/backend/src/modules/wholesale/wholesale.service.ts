import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginatedResult } from '@amader/shared';
import { Prisma, WholesaleOrderStatus, WholesaleOrderType } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { paginationArgs, toPaginatedResult } from '../../common/pagination.util';
import { LedgerService } from '../net-profit/accounts/ledger/ledger.service';
import { DuesService } from '../net-profit/accounts/dues/dues.service';
import { AccountsSettingsService } from '../net-profit/accounts/accounts-settings.service';
import { nextDueDocNo } from '../net-profit/accounts/document-numbers';
import {
  CreateWholesaleCustomerDto,
  CreateWholesaleOrderDto,
  RecordWholesalePaymentDto,
  UpdateWholesaleCustomerDto,
  UpdateWholesaleOrderDto,
  WholesaleCustomerQueryDto,
  WholesaleOrderQueryDto,
} from './dto/wholesale.dto';
import {
  WholesaleCustomerDto,
  WholesaleOrderDto,
  WholesaleStatsDto,
  toWholesaleOrderDto,
} from './wholesale.mapper';

const Decimal = Prisma.Decimal;
const ZERO = new Decimal(0);

const ORDER_INCLUDE = {
  party: { select: { id: true, name: true, phone: true } },
  // The line's picture is resolved from the product rather than snapshotted
  // beside the name and price. The snapshots exist because those are
  // financial facts that must never change under a past invoice; a thumbnail
  // is not one, and a product whose photo was later replaced should show the
  // photo it has. Null once the product is deleted -- the UI falls back to a
  // lettered placeholder, and the name snapshot still says what was sold.
  items: {
    include: {
      product: {
        select: {
          media: {
            select: { media: { select: { url: true } } },
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
            take: 1,
          },
        },
      },
    },
  },
  dues: { select: { id: true, docNo: true, voidedAt: true, kind: true } },
} satisfies Prisma.WholesaleOrderInclude;

/** Statuses that have NOT put the goods back on the shelf. */
const LIVE_STATUSES: WholesaleOrderStatus[] = ['PENDING', 'PROCESSING', 'DELIVERED'];

function decimalOrThrow(value: string | undefined, field: string, fallback = ZERO) {
  if (value === undefined || value === '') return fallback;
  try {
    return new Decimal(value);
  } catch {
    throw new BadRequestException(`${field} must be a number`);
  }
}

/** Midnight UTC, so a DATE column round-trips to the same day in every timezone. */
function toDateOnly(iso?: string): Date {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid date');
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * WS-YYMM-NNNN, derived from the highest existing suffix in the month rather
 * than a row count — same reasoning as nextDueDocNo: a count hands out a
 * number that is already taken the moment anyone backdates an order into a
 * month that already has some. The unique index is the backstop for a race.
 */
async function nextOrderNumber(
  tx: Prisma.TransactionClient,
  date: Date,
): Promise<string> {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  const yymm = `${String(date.getUTCFullYear()).slice(2)}${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  const prefix = `WS-${yymm}`;
  const latest = await tx.wholesaleOrder.findFirst({
    where: { placedAt: { gte: start, lt: end } },
    orderBy: { orderNumber: 'desc' },
    select: { orderNumber: true },
  });
  const suffix = Number.parseInt(latest?.orderNumber.slice(prefix.length + 1) ?? '', 10);
  const seq = Number.isFinite(suffix) ? suffix + 1 : 1;
  return `${prefix}-${String(seq).padStart(4, '0')}`;
}

/**
 * Net stock movement between the lines an order had and the lines it will
 * have, keyed `p:<productId>` / `v:<variantId>`.
 *
 * Positive = more goods leaving (decrement), negative = coming back. Digital
 * lines are excluded on both sides, exactly as they were on the way in.
 */
function stockDeltas(
  before: {
    productId: number | null;
    variantId: number | null;
    quantity: number;
    product?: { productType: string } | null;
  }[],
  after: {
    productId: number | null;
    variantId: number | null;
    quantity: number;
    isDigital?: boolean;
  }[],
): Map<string, number> {
  const deltas = new Map<string, number>();
  const key = (productId: number | null, variantId: number | null) =>
    variantId ? `v:${variantId}` : productId ? `p:${productId}` : null;

  for (const line of before) {
    if (line.product?.productType === 'DIGITAL') continue;
    const k = key(line.productId, line.variantId);
    if (k) deltas.set(k, (deltas.get(k) ?? 0) - line.quantity);
  }
  for (const line of after) {
    if (line.isDigital) continue;
    const k = key(line.productId, line.variantId);
    if (k) deltas.set(k, (deltas.get(k) ?? 0) + line.quantity);
  }
  return deltas;
}

/**
 * Wholesale: bulk orders placed by hand for the shops we sell to.
 *
 * Two boundaries define this service, and both are deliberate:
 *
 * 1. **Out of retail.** Nothing here writes to `Order` or `Customer`, so a
 *    wholesale sale cannot appear in the Order Manager or the Customers list.
 *    That is a structural guarantee, not a filter someone has to remember.
 *
 * 2. **Into accounts.** Every order raises one receivable (`Due`, source
 *    WHOLESALE_INVOICE) against the buyer's `Party`, and every payment is a
 *    ledger entry on that due. So wholesale revenue, collections and
 *    outstanding balances report through the existing Accounts pages with no
 *    parallel wholesale reporting path that could drift.
 *
 * Stock is the third crossing: goods sold wholesale left the same warehouse
 * the storefront sells from, so lines decrement the same `stock` columns.
 */
@Injectable()
export class WholesaleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly dues: DuesService,
    private readonly settings: AccountsSettingsService,
  ) {}

  // -------------------------------------------------------------------------
  // Customers (parties carrying the WHOLESALE role)
  // -------------------------------------------------------------------------

  async listCustomers(
    query: WholesaleCustomerQueryDto,
  ): Promise<PaginatedResult<WholesaleCustomerDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const search = query.search?.trim();

    const where: Prisma.PartyWhereInput = {
      roles: { has: 'WHOLESALE' },
      deletedAt: null,
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { alternativePhone: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { address: { contains: search, mode: 'insensitive' } },
              { district: { contains: search, mode: 'insensitive' } },
              { thana: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.client.party.findMany({
        where,
        orderBy: { name: 'asc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.party.count({ where }),
    ]);

    const items = await this.decorateCustomers(rows);
    return toPaginatedResult(items, total, page, pageSize);
  }

  /**
   * Order counts and lifetime purchase in one grouped query for the whole
   * page, and outstanding straight off the ledger — never a stored balance,
   * which is what lets the Wholesale list and the Accounts party statement
   * agree by construction.
   */
  private async decorateCustomers(
    parties: {
      id: number;
      name: string;
      phone: string | null;
      email: string | null;
      alternativePhone: string | null;
      address: string | null;
      district: string | null;
      thana: string | null;
      landmark: string | null;
      postCode: string | null;
      creditLimit: Prisma.Decimal | null;
      creditDays: number | null;
      note: string | null;
      isActive: boolean;
    }[],
  ): Promise<WholesaleCustomerDto[]> {
    const ids = parties.map((p) => p.id);
    // Unconditional: `{ in: [] }` already returns nothing, and short-circuiting
    // on an empty page only buys a union type that loses the aggregate shape.
    //
    // Grouped by type as well as party so the dashboard's wholesale/cash split
    // costs the same single query the plain count used to.
    const [totals, positions] = await Promise.all([
      this.prisma.client.wholesaleOrder.groupBy({
        by: ['partyId', 'type'],
        where: { partyId: { in: ids }, status: { in: LIVE_STATUSES } },
        _count: { _all: true },
        _sum: { total: true },
        _max: { placedAt: true },
      }),
      this.ledger.partyPositions(ids),
    ]);

    type Agg = {
      count: number;
      wholesale: number;
      cash: number;
      total: Prisma.Decimal;
      last: Date | null;
    };
    const byParty = new Map<number, Agg>();
    for (const row of totals) {
      const acc: Agg = byParty.get(row.partyId) ?? {
        count: 0,
        wholesale: 0,
        cash: 0,
        total: ZERO,
        last: null,
      };
      const n = row._count._all;
      acc.count += n;
      if (row.type === 'CASH_SALE') acc.cash += n;
      else acc.wholesale += n;
      acc.total = acc.total.plus(row._sum.total ?? ZERO);
      const placed = row._max.placedAt;
      if (placed && (!acc.last || placed > acc.last)) acc.last = placed;
      byParty.set(row.partyId, acc);
    }

    return parties.map((p) => {
      const t = byParty.get(p.id);
      return {
        id: p.id,
        name: p.name,
        phone: p.phone,
        address: p.address,
        email: p.email,
        alternativePhone: p.alternativePhone,
        district: p.district,
        thana: p.thana,
        landmark: p.landmark,
        postCode: p.postCode,
        creditLimit: p.creditLimit?.toFixed(2) ?? null,
        creditDays: p.creditDays,
        note: p.note,
        isActive: p.isActive,
        orderCount: t?.count ?? 0,
        wholesaleCount: t?.wholesale ?? 0,
        cashCount: t?.cash ?? 0,
        purchaseTotal: (t?.total ?? ZERO).toFixed(2),
        due: (positions.get(p.id)?.receivable ?? ZERO).toFixed(2),
        lastOrderAt: t?.last ?? null,
      };
    });
  }

  /**
   * Headline numbers for both dashboards, in one call.
   *
   * Deliberately server-side. The screens page their tables, so totalling the
   * rows the browser happens to be holding would report three orders for a
   * business with three hundred, and would change every time someone typed in
   * the search box.
   */
  async stats(): Promise<WholesaleStatsDto> {
    const live = { status: { in: LIVE_STATUSES } };
    const [byType, buyers, customerCount, parties] = await Promise.all([
      this.prisma.client.wholesaleOrder.groupBy({
        by: ['type'],
        where: live,
        _count: { _all: true },
        _sum: { total: true },
      }),
      this.prisma.client.wholesaleOrder.groupBy({ by: ['type', 'partyId'], where: live }),
      this.prisma.client.party.count({
        where: { roles: { has: 'WHOLESALE' }, deletedAt: null },
      }),
      this.prisma.client.party.findMany({
        where: { roles: { has: 'WHOLESALE' }, deletedAt: null },
        select: { id: true },
      }),
    ]);

    const countOf = (t: WholesaleOrderType) =>
      byType.find((r) => r.type === t)?._count._all ?? 0;
    const buyersOf = (t: WholesaleOrderType) =>
      new Set(buyers.filter((r) => r.type === t).map((r) => r.partyId)).size;

    const positions = await this.ledger.partyPositions(parties.map((p) => p.id));
    const dueTotal = [...positions.values()].reduce(
      (sum, pos) => sum.plus(pos.receivable ?? ZERO),
      ZERO,
    );

    return {
      orderCount: byType.reduce((n, r) => n + r._count._all, 0),
      wholesaleOrderCount: countOf('WHOLESALE'),
      cashSaleCount: countOf('CASH_SALE'),
      salesTotal: byType.reduce((sum, r) => sum.plus(r._sum.total ?? ZERO), ZERO).toFixed(2),
      dueTotal: dueTotal.toFixed(2),
      customerCount,
      wholesaleCustomerCount: buyersOf('WHOLESALE'),
      cashCustomerCount: buyersOf('CASH_SALE'),
    };
  }

  async findCustomer(id: number): Promise<WholesaleCustomerDto> {
    const party = await this.prisma.client.party.findFirst({
      where: { id, roles: { has: 'WHOLESALE' }, deletedAt: null },
    });
    if (!party) throw new NotFoundException(`Wholesale customer ${id} not found`);
    const [dto] = await this.decorateCustomers([party]);
    return dto;
  }

  async createCustomer(dto: CreateWholesaleCustomerDto): Promise<WholesaleCustomerDto> {
    // Duplicate NAMES are allowed on purpose — several shops genuinely trade
    // under the same one, and the request was explicitly to support that. The
    // phone number is what distinguishes them, so that is what gets checked,
    // and even it only warns by rejecting an exact re-entry of a live buyer.
    const phone = dto.phone.trim();
    const clash = await this.prisma.client.party.findFirst({
      where: { phone, roles: { has: 'WHOLESALE' }, deletedAt: null },
      select: { id: true, name: true },
    });
    if (clash) {
      throw new BadRequestException(
        `${clash.name} is already registered on ${phone}`,
      );
    }

    const party = await this.prisma.client.party.create({
      data: {
        name: dto.name.trim(),
        type: 'COMPANY',
        roles: ['WHOLESALE', 'CUSTOMER'],
        phone,
        address: dto.address?.trim() || null,
        email: dto.email?.trim() || null,
        alternativePhone: dto.alternativePhone?.trim() || null,
        district: dto.district?.trim() || null,
        thana: dto.thana?.trim() || null,
        landmark: dto.landmark?.trim() || null,
        postCode: dto.postCode?.trim() || null,
        creditLimit: dto.creditLimit ? new Decimal(dto.creditLimit) : null,
        creditDays: dto.creditDays ?? null,
        openingReceivable: decimalOrThrow(dto.openingReceivable, 'openingReceivable'),
        note: dto.note?.trim() || null,
        isActive: dto.isActive ?? true,
      },
    });
    const [result] = await this.decorateCustomers([party]);
    return result;
  }

  async updateCustomer(
    id: number,
    dto: UpdateWholesaleCustomerDto,
  ): Promise<WholesaleCustomerDto> {
    await this.findCustomer(id);
    await this.prisma.client.party.update({
      where: { id },
      data: {
        ...(dto.name === undefined ? {} : { name: dto.name.trim() }),
        ...(dto.phone === undefined ? {} : { phone: dto.phone.trim() }),
        ...(dto.address === undefined ? {} : { address: dto.address.trim() || null }),
        ...(dto.email === undefined ? {} : { email: dto.email.trim() || null }),
        ...(dto.alternativePhone === undefined
          ? {}
          : { alternativePhone: dto.alternativePhone.trim() || null }),
        ...(dto.district === undefined ? {} : { district: dto.district.trim() || null }),
        ...(dto.thana === undefined ? {} : { thana: dto.thana.trim() || null }),
        ...(dto.landmark === undefined ? {} : { landmark: dto.landmark.trim() || null }),
        ...(dto.postCode === undefined ? {} : { postCode: dto.postCode.trim() || null }),
        ...(dto.creditLimit === undefined
          ? {}
          : { creditLimit: dto.creditLimit ? new Decimal(dto.creditLimit) : null }),
        ...(dto.creditDays === undefined ? {} : { creditDays: dto.creditDays }),
        ...(dto.note === undefined ? {} : { note: dto.note.trim() || null }),
        ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
      },
    });
    return this.findCustomer(id);
  }

  /**
   * Soft-delete, and refused while the buyer still has live orders.
   *
   * Hard-deleting would take their ledger history with it; blocking while
   * orders stand means the Accounts party statement can never point at a
   * counterparty that no longer exists.
   */
  async deleteCustomer(id: number): Promise<{ id: number }> {
    await this.findCustomer(id);
    const live = await this.prisma.client.wholesaleOrder.count({
      where: { partyId: id, status: { in: LIVE_STATUSES } },
    });
    if (live > 0) {
      throw new BadRequestException(
        `That buyer has ${live} order${live === 1 ? '' : 's'} on the books. Deactivate them instead.`,
      );
    }
    await this.prisma.client.party.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { id };
  }

  // -------------------------------------------------------------------------
  // Orders
  // -------------------------------------------------------------------------

  /** Shared by the list and the CSV export, so an export can never quietly
   *  cover a different set of orders than the screen that triggered it. */
  private buildOrderWhere(query: WholesaleOrderQueryDto): Prisma.WholesaleOrderWhereInput {
    const search = query.search?.trim();
    return {
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.partyId ? { partyId: query.partyId } : {}),
      // Every column the dashboard prints is searchable, products included:
      // staff look an order up by what was in it at least as often as by its
      // number.
      ...(search
        ? {
            OR: [
              { orderNumber: { contains: search, mode: 'insensitive' } },
              { consignmentId: { contains: search, mode: 'insensitive' } },
              { gpNumber: { contains: search, mode: 'insensitive' } },
              { transactionId: { contains: search, mode: 'insensitive' } },
              { recipientName: { contains: search, mode: 'insensitive' } },
              { recipientPhone: { contains: search, mode: 'insensitive' } },
              { addressLine: { contains: search, mode: 'insensitive' } },
              { party: { name: { contains: search, mode: 'insensitive' } } },
              { party: { phone: { contains: search, mode: 'insensitive' } } },
              { items: { some: { nameSnapshot: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
  }

  async listOrders(
    query: WholesaleOrderQueryDto,
  ): Promise<PaginatedResult<WholesaleOrderDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildOrderWhere(query);

    const [rows, total] = await Promise.all([
      this.prisma.client.wholesaleOrder.findMany({
        where,
        include: ORDER_INCLUDE,
        orderBy: [{ placedAt: 'desc' }, { id: 'desc' }],
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.wholesaleOrder.count({ where }),
    ]);

    const items = await this.withPaid(rows);
    return toPaginatedResult(items, total, page, pageSize);
  }

  /** One grouped ledger read for the whole page, not one per order. */
  private async withPaid(
    rows: Prisma.WholesaleOrderGetPayload<{ include: typeof ORDER_INCLUDE }>[],
  ): Promise<WholesaleOrderDto[]> {
    const liveDues = rows.flatMap((r) => r.dues.filter((d) => !d.voidedAt));
    const paidByDue = await this.ledger.paidForDues(liveDues);
    return rows.map((row) => {
      const paid = row.dues
        .filter((d) => !d.voidedAt)
        .reduce((sum, d) => sum.plus(paidByDue.get(d.id) ?? ZERO), ZERO);
      return toWholesaleOrderDto(row, paid);
    });
  }

  /**
   * The orders list as CSV, honouring the same filters the screen is showing.
   *
   * One row per order (not per line): this is a sales/collection register for
   * reconciling against Accounts, and per-line detail belongs on the invoice.
   * Quoted on every free-text column because buyer names and notes genuinely
   * contain commas.
   */
  async exportOrdersCsv(query: WholesaleOrderQueryDto): Promise<string> {
    const rows = await this.prisma.client.wholesaleOrder.findMany({
      where: this.buildOrderWhere(query),
      include: ORDER_INCLUDE,
      orderBy: [{ placedAt: 'desc' }, { id: 'desc' }],
      take: 10_000,
    });
    const orders = await this.withPaid(rows);

    const header =
      'Order,Date,Invoice,Customer,Phone,Courier,Consignment,Items,Subtotal,Delivery,Discount,Total,Paid,Due,Status';
    const q = (v: string | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;

    const lines = orders.map((o) =>
      [
        o.orderNumber,
        o.placedAt.toISOString().slice(0, 10),
        o.invoiceDocNo ?? '',
        q(o.customerName),
        q(o.customerPhone),
        o.courier,
        q(o.consignmentId),
        o.items.length,
        o.subtotal,
        o.deliveryCharge,
        o.discount,
        o.total,
        o.paid,
        o.due,
        o.status,
      ].join(','),
    );
    return [header, ...lines].join('\n');
  }

  async findOrder(id: number): Promise<WholesaleOrderDto> {
    const row = await this.prisma.client.wholesaleOrder.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });
    if (!row) throw new NotFoundException(`Wholesale order ${id} not found`);
    const [dto] = await this.withPaid([row]);
    return dto;
  }

  async createOrder(
    dto: CreateWholesaleOrderDto,
    adminId: number | null,
  ): Promise<WholesaleOrderDto> {
    const party = await this.prisma.client.party.findFirst({
      where: { id: dto.partyId, roles: { has: 'WHOLESALE' }, deletedAt: null },
    });
    if (!party) throw new NotFoundException(`Wholesale customer ${dto.partyId} not found`);
    if (!party.isActive) {
      throw new BadRequestException(`${party.name} is deactivated`);
    }

    // A cash sale is handed over the counter and a wholesale order is
    // couriered. Enforced here rather than left to the UI, because the
    // difference decides whether a delivery snapshot means anything and
    // whether `courier` may be null at all.
    const type = dto.type ?? 'WHOLESALE';
    if (type === 'WHOLESALE' && !dto.courier) {
      throw new BadRequestException('A wholesale order needs a courier');
    }
    if (type === 'CASH_SALE' && dto.courier) {
      throw new BadRequestException('A cash sale is not couriered');
    }
    // The counter voucher number. It is what a walk-in customer is handed and
    // what the day's till is reconciled against, so a cash sale without one
    // cannot be traced back to a physical receipt.
    if (type === 'CASH_SALE' && !dto.gpNumber?.trim()) {
      throw new BadRequestException('A cash sale needs its GP number');
    }
    // Every non-cash method settles through a gateway that hands back a
    // reference; without it a payment cannot be reconciled against a
    // statement later.
    if (dto.paymentMethod && dto.paymentMethod !== 'CASH' && !dto.transactionId?.trim()) {
      throw new BadRequestException(
        `A ${dto.paymentMethod} payment needs its transaction ID`,
      );
    }

    const lines = await this.resolveLines(dto.items);
    const subtotal = lines.reduce((sum, l) => sum.plus(l.lineTotal), ZERO);
    const deliveryCharge = decimalOrThrow(dto.deliveryCharge, 'deliveryCharge');
    const discount = decimalOrThrow(dto.discount, 'discount');
    if (deliveryCharge.isNegative() || discount.isNegative()) {
      throw new BadRequestException('Delivery charge and discount cannot be negative');
    }

    const total = subtotal.plus(deliveryCharge).minus(discount);
    if (total.isNegative()) {
      throw new BadRequestException('The discount is larger than the order');
    }
    if (total.isZero()) {
      // A zero-value receivable is not a document anyone can act on, and the
      // ledger would carry a sale that moved no money.
      throw new BadRequestException('Order total must be greater than zero');
    }

    const paid = decimalOrThrow(dto.paidAmount, 'paidAmount');
    if (paid.isNegative()) throw new BadRequestException('Paid amount cannot be negative');
    if (paid.greaterThan(total)) {
      throw new BadRequestException(
        `Paid amount is more than the ৳${total.toFixed(2)} bill`,
      );
    }

    const placedAt = toDateOnly(dto.placedAt);
    await this.ledger.assertPeriodOpen(placedAt);

    // Resolved before the transaction opens: a payment with nowhere to land
    // must fail the whole order, not book a sale whose cash silently vanished.
    const accountId = paid.isZero() ? null : await this.resolveAccount(dto.paymentAccountId);

    const dueDate = party.creditDays
      ? new Date(placedAt.getTime() + party.creditDays * 86_400_000)
      : null;

    const created = await this.prisma.client.$transaction(async (tx) => {
      const order = await tx.wholesaleOrder.create({
        data: {
          orderNumber: await nextOrderNumber(tx, placedAt),
          partyId: party.id,
          status: dto.status ?? 'PENDING',
          type,
          channel: dto.channel ?? null,
          paymentMethod: dto.paymentMethod ?? null,
          // Derived, not taken from the client: the truth is what was
          // actually collected against the receivable.
          paymentStatus: paid.isZero()
            ? 'UNPAID'
            : paid.greaterThanOrEqualTo(total)
              ? 'PAID'
              : 'PARTIALLY_PAID',
          transactionId: dto.transactionId?.trim() || null,
          gpNumber: dto.gpNumber?.trim() || null,
          courier: dto.courier ?? null,
          consignmentId: dto.consignmentId?.trim() || null,
          // Cash sales store no delivery snapshot at all — there is no
          // delivery. Spreading the object regardless would write empty
          // strings that read as "known to be blank" rather than "n/a".
          ...(dto.delivery
            ? {
                recipientName: dto.delivery.recipientName?.trim() || null,
                recipientPhone: dto.delivery.recipientPhone?.trim() || null,
                alternativePhone: dto.delivery.alternativePhone?.trim() || null,
                recipientEmail: dto.delivery.recipientEmail?.trim() || null,
                addressLine: dto.delivery.addressLine?.trim() || null,
                district: dto.delivery.district?.trim() || null,
                thana: dto.delivery.thana?.trim() || null,
                landmark: dto.delivery.landmark?.trim() || null,
                postCode: dto.delivery.postCode?.trim() || null,
              }
            : {}),
          subtotal,
          deliveryCharge,
          discount,
          total,
          note: dto.note?.trim() || null,
          placedAt,
          createdBy: adminId,
          items: {
            create: lines.map((l) => ({
              productId: l.productId,
              variantId: l.variantId,
              nameSnapshot: l.name,
              skuSnapshot: l.sku,
              unitPrice: l.unitPrice,
              quantity: l.quantity,
              discount: l.discount,
              lineTotal: l.lineTotal,
            })),
          },
        },
      });

      await this.moveStock(tx, lines, 'decrement');

      const due = await tx.due.create({
        data: {
          docNo: await nextDueDocNo(tx as never, 'RECEIVABLE', placedAt),
          kind: 'RECEIVABLE',
          partyId: party.id,
          source: 'WHOLESALE_INVOICE',
          amount: total,
          issueDate: placedAt,
          dueDate,
          wholesaleOrderId: order.id,
          note: `Wholesale order ${order.orderNumber}`,
          createdBy: adminId,
        },
      });

      if (accountId !== null && paid.greaterThan(ZERO)) {
        await this.ledger.post(
          {
            entryDate: placedAt,
            direction: 'IN',
            amount: paid,
            accountId,
            partyId: party.id,
            source: 'RECEIVABLE_RECEIPT',
            dueId: due.id,
            reference: order.orderNumber,
            note: `Wholesale payment on ${order.orderNumber}`,
          },
          adminId,
          tx,
        );
      }

      return order;
    });

    return this.findOrder(created.id);
  }

  /**
   * Edit a placed order.
   *
   * Light fields alone are a plain update. Supplying `items` (or either money
   * field) restates the sale, and the two consequences are handled in the same
   * transaction rather than left to drift:
   *
   *   * **Stock** moves by the *difference* per product, not by re-running the
   *     original decrement — the goods already left once.
   *   * **The invoice** (`Due.amount`) is rewritten to the new total. Payments
   *     already collected are `LedgerEntry` rows against that due and are left
   *     untouched, which is why the new total may not fall below them.
   */
  async updateOrder(id: number, dto: UpdateWholesaleOrderDto): Promise<WholesaleOrderDto> {
    const order = await this.prisma.client.wholesaleOrder.findUnique({
      where: { id },
      include: {
        items: { include: { product: { select: { productType: true } } } },
        dues: { where: { voidedAt: null }, select: { id: true, kind: true } },
      },
    });
    if (!order) throw new NotFoundException(`Wholesale order ${id} not found`);
    if (order.status === 'CANCELLED') {
      throw new BadRequestException(
        'That order is cancelled. Cancelling restocked the goods and voided the invoice, so there is nothing left to edit.',
      );
    }
    // Cancelling restocks and voids the receivable, so it cannot be a field
    // edit — it goes through cancelOrder, which does both in one transaction.
    if (dto.status === 'CANCELLED') {
      throw new BadRequestException('Use the cancel endpoint to cancel an order');
    }
    // Same rule the create path enforces, restated here so an edit cannot get
    // an order into a shape creating it never could.
    if (order.type === 'CASH_SALE' && dto.courier) {
      throw new BadRequestException('A cash sale is not couriered');
    }

    const light = {
      ...(dto.status === undefined ? {} : { status: dto.status }),
      ...(dto.courier === undefined ? {} : { courier: dto.courier }),
      ...(dto.consignmentId === undefined
        ? {}
        : { consignmentId: dto.consignmentId.trim() || null }),
      ...(dto.note === undefined ? {} : { note: dto.note.trim() || null }),
    };

    const restating =
      dto.items !== undefined ||
      dto.deliveryCharge !== undefined ||
      dto.discount !== undefined;

    if (!restating) {
      await this.prisma.client.wholesaleOrder.update({ where: { id }, data: light });
      return this.findOrder(id);
    }

    // Omitted money fields keep their current value, so a caller editing only
    // the lines does not silently zero the delivery charge.
    const deliveryCharge = decimalOrThrow(
      dto.deliveryCharge,
      'deliveryCharge',
      order.deliveryCharge,
    );
    const discount = decimalOrThrow(dto.discount, 'discount', order.discount);
    if (deliveryCharge.isNegative() || discount.isNegative()) {
      throw new BadRequestException('Delivery charge and discount cannot be negative');
    }

    const lines = dto.items
      ? await this.resolveLines(dto.items)
      : order.items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          name: i.nameSnapshot,
          sku: i.skuSnapshot,
          isDigital: i.product?.productType === 'DIGITAL',
          unitPrice: i.unitPrice,
          quantity: i.quantity,
          // Carried through: this branch is "the caller changed the money but
          // not the lines", so an existing per-line discount must survive the
          // restatement rather than silently reset to zero.
          discount: i.discount,
          lineTotal: i.lineTotal,
        }));

    const subtotal = lines.reduce((sum, l) => sum.plus(l.lineTotal), ZERO);
    const total = subtotal.plus(deliveryCharge).minus(discount);
    if (total.isNegative()) {
      throw new BadRequestException('The discount is larger than the order');
    }
    if (total.isZero()) {
      throw new BadRequestException('Order total must be greater than zero');
    }

    const due = order.dues[0];
    if (!due) {
      throw new BadRequestException(
        'That order has no open invoice, so its value cannot be restated.',
      );
    }
    const paidByDue = await this.ledger.paidForDues(order.dues);
    const paid = paidByDue.get(due.id) ?? ZERO;
    if (total.lessThan(paid)) {
      throw new BadRequestException(
        `৳${paid.toFixed(2)} has already been collected on this order, so it cannot be restated below that. Reverse the receipt in Accounts first.`,
      );
    }

    await this.ledger.assertPeriodOpen(order.placedAt);

    await this.prisma.client.$transaction(async (tx) => {
      // Stock by difference. A per-product delta means an edit that only
      // changes a price moves no stock at all, and one that raises a quantity
      // from 2 to 3 moves exactly one unit — never the whole line twice.
      for (const [key, delta] of stockDeltas(order.items, lines)) {
        if (delta === 0) continue;
        const [kind, rawId] = key.split(':');
        const where = { id: Number(rawId) };
        const data = { stock: delta > 0 ? { decrement: delta } : { increment: -delta } };
        if (kind === 'v') await tx.productVariant.update({ where, data });
        else await tx.product.update({ where, data });
      }

      await tx.wholesaleOrderItem.deleteMany({ where: { orderId: id } });
      await tx.wholesaleOrder.update({
        where: { id },
        data: {
          ...light,
          subtotal,
          deliveryCharge,
          discount,
          total,
          items: {
            create: lines.map((l) => ({
              productId: l.productId,
              variantId: l.variantId,
              nameSnapshot: l.name,
              skuSnapshot: l.sku,
              unitPrice: l.unitPrice,
              quantity: l.quantity,
              discount: l.discount,
              lineTotal: l.lineTotal,
            })),
          },
        },
      });

      // The invoice follows the sale. Its doc number and its payments stay
      // put, so Accounts keeps one continuous record rather than a
      // void-and-reissue pair for what was only a correction.
      await tx.due.update({ where: { id: due.id }, data: { amount: total } });
    });

    return this.findOrder(id);
  }

  /**
   * Cancel: put the goods back and void the invoice, together.
   *
   * Refused once money has been collected, because voiding a due that has
   * receipts against it leaves those receipts pointing at a document that no
   * longer claims anything. Reverse the receipt in Accounts first — that is a
   * money decision, and it belongs where the money is managed.
   */
  async cancelOrder(id: number, adminId: number | null): Promise<WholesaleOrderDto> {
    const order = await this.prisma.client.wholesaleOrder.findUnique({
      where: { id },
      include: {
        ...ORDER_INCLUDE,
        // productType, because a digital line was never decremented on the way
        // in and must not be incremented on the way out — that would conjure
        // stock that never existed.
        items: { include: { product: { select: { productType: true } } } },
      },
    });
    if (!order) throw new NotFoundException(`Wholesale order ${id} not found`);
    if (order.status === 'CANCELLED') {
      throw new BadRequestException('That order is already cancelled');
    }

    const liveDues = order.dues.filter((d) => !d.voidedAt);
    const paidByDue = await this.ledger.paidForDues(liveDues);
    const paid = liveDues.reduce((sum, d) => sum.plus(paidByDue.get(d.id) ?? ZERO), ZERO);
    if (paid.greaterThan(ZERO)) {
      throw new BadRequestException(
        `৳${paid.toFixed(2)} has been collected on this order. Reverse the receipt in Accounts before cancelling.`,
      );
    }

    await this.prisma.client.$transaction(async (tx) => {
      await tx.wholesaleOrder.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
      await this.moveStock(
        tx,
        order.items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
          isDigital: i.product?.productType === 'DIGITAL',
        })),
        'increment',
      );
    });

    // Voided outside the stock transaction on purpose: DuesService.void runs
    // its own, and nesting one Prisma transaction inside another deadlocks.
    for (const due of liveDues) {
      await this.dues.void(due.id, adminId);
    }

    return this.findOrder(id);
  }

  /** A later collection against the order's receivable. */
  async recordPayment(
    id: number,
    dto: RecordWholesalePaymentDto,
    adminId: number | null,
  ): Promise<WholesaleOrderDto> {
    const order = await this.prisma.client.wholesaleOrder.findUnique({
      where: { id },
      include: { dues: { where: { voidedAt: null }, select: { id: true } } },
    });
    if (!order) throw new NotFoundException(`Wholesale order ${id} not found`);
    const due = order.dues[0];
    if (!due) {
      throw new BadRequestException('That order has no open invoice to pay against');
    }

    const accountId = await this.resolveAccount(dto.accountId);
    // Delegated rather than reimplemented: DuesService already enforces
    // "never more than outstanding", period locking, and posts through the
    // one service permitted to write a ledger entry.
    await this.dues.recordPayment(
      due.id,
      {
        amount: dto.amount,
        paymentDate: (dto.paymentDate ?? new Date().toISOString()).slice(0, 10),
        accountId,
        reference: dto.reference,
        note: dto.note,
      },
      adminId,
    );
    return this.findOrder(id);
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private async resolveAccount(explicit?: number): Promise<number> {
    if (explicit) return explicit;
    const { defaultCashAccountId } = await this.settings.getPostingSettings();
    if (!defaultCashAccountId) {
      // ponytail: an error rather than a per-order account picker in the UI.
      // Upgrade path is that picker — but silently skipping the posting, the
      // way best-effort order postings do, would lose cash an admin typed in
      // by hand and believed was recorded.
      throw new BadRequestException(
        'No default cash account is configured. Set one in Settings → Accounts, or choose an account for this payment.',
      );
    }
    return defaultCashAccountId;
  }

  /**
   * Turn requested lines into priced, named lines.
   *
   * Names and SKUs are snapshotted here rather than joined at read time for
   * the same reason OrderItem does it: the invoice must keep reading correctly
   * after the product is renamed or deleted.
   */
  private async resolveLines(items: CreateWholesaleOrderDto['items']) {
    if (!items.length) throw new BadRequestException('Add at least one product');

    const variantIds = items.map((i) => i.variantId).filter((v): v is number => !!v);
    const productIds = items
      .filter((i) => !i.variantId)
      .map((i) => i.productId)
      .filter((v): v is number => !!v);

    const [variants, products] = await Promise.all([
      this.prisma.client.productVariant.findMany({
        where: { id: { in: variantIds } },
        select: {
          id: true,
          sku: true,
          productId: true,
          product: {
            select: {
              slug: true,
              productType: true,
              translations: { select: { name: true }, take: 1 },
            },
          },
        },
      }),
      this.prisma.client.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          sku: true,
          slug: true,
          productType: true,
          translations: { select: { name: true }, take: 1 },
        },
      }),
    ]);
    const variantById = new Map(variants.map((v) => [v.id, v] as const));
    const productById = new Map(products.map((p) => [p.id, p] as const));

    return items.map((item) => {
      const unitPrice = decimalOrThrow(item.unitPrice, 'unitPrice');
      if (unitPrice.isNegative()) {
        throw new BadRequestException('A wholesale rate cannot be negative');
      }
      // Taka off this line, before the order-level discount. Clamped at the
      // line's own value: a per-line discount larger than the line would make
      // lineTotal negative, and the subtotal would then be understated with
      // nothing on the invoice explaining why.
      const lineDiscount = decimalOrThrow(item.discount, 'discount');
      if (lineDiscount.isNegative()) {
        throw new BadRequestException('A line discount cannot be negative');
      }
      const gross = unitPrice.times(item.quantity);
      if (lineDiscount.greaterThan(gross)) {
        throw new BadRequestException(
          `A line discount of ৳${lineDiscount.toFixed(2)} is more than the ৳${gross.toFixed(2)} line`,
        );
      }
      const net = gross.minus(lineDiscount);

      if (item.variantId) {
        const v = variantById.get(item.variantId);
        if (!v) throw new NotFoundException(`Variant ${item.variantId} not found`);
        return {
          productId: v.productId,
          variantId: v.id,
          name: `${v.product.translations[0]?.name ?? v.product.slug}${v.sku ? ` (${v.sku})` : ''}`,
          sku: v.sku,
          isDigital: v.product.productType === 'DIGITAL',
          unitPrice,
          quantity: item.quantity,
          discount: lineDiscount,
          lineTotal: net,
        };
      }

      if (!item.productId) {
        throw new BadRequestException('Each line needs a product or a variant');
      }
      const p = productById.get(item.productId);
      if (!p) throw new NotFoundException(`Product ${item.productId} not found`);
      return {
        productId: p.id,
        variantId: null,
        name: p.translations[0]?.name ?? p.slug,
        sku: p.sku,
        isDigital: p.productType === 'DIGITAL',
        unitPrice,
        quantity: item.quantity,
        discount: lineDiscount,
        lineTotal: net,
      };
    });
  }

  /**
   * Move the same `stock` columns the storefront sells from.
   *
   * Wholesale is allowed to drive stock negative. The sale has already
   * happened at the counter by the time it is typed in, so refusing it would
   * only mean the system disagrees with the warehouse — and a negative number
   * is a visible problem, where a blocked save is a lost record. Reservations
   * are untouched: nothing reserves for a wholesale order, so there is no
   * reservation to consume or release.
   *
   * Digital lines are skipped for the same reason OrderItem skips them: they
   * have no stock to move.
   */
  private async moveStock(
    tx: Prisma.TransactionClient,
    lines: {
      productId: number | null;
      variantId: number | null;
      quantity: number;
      isDigital?: boolean;
    }[],
    direction: 'increment' | 'decrement',
  ): Promise<void> {
    for (const line of lines) {
      if (line.isDigital) continue;
      if (line.variantId) {
        await tx.productVariant.update({
          where: { id: line.variantId },
          data: { stock: { [direction]: line.quantity } },
        });
      } else if (line.productId) {
        await tx.product.update({
          where: { id: line.productId },
          data: { stock: { [direction]: line.quantity } },
        });
      }
    }
  }
}
