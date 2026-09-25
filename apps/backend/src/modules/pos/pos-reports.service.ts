import { Injectable } from '@nestjs/common';
import { Locale, Prisma } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PosCatalogService } from './pos-catalog.service';
import { dhakaRange } from './dhaka-range';
import { dhakaDate } from '../product-cost-history/dhaka-date';

// A leading = + - @ (or tab/CR) makes Excel run the cell as a formula; a
// customer named "=HYPERLINK(...)" must stay text. Real numbers are left alone.
const FORMULA_START = /^[=+\-@\t\r]/;

export function toCsv(
  rows: Record<string, string | number | null>[],
  columns?: string[],
  headers?: Record<string, string>,
): string {
  const keys = columns ?? (rows[0] ? Object.keys(rows[0]) : []);
  if (keys.length === 0) return '';
  const cell = (v: string | number | null) => {
    let s = v === null || v === undefined ? '' : String(v);
    if (typeof v === 'string' && FORMULA_START.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    keys.map((k) => cell(headers?.[k] ?? k)).join(','),
    ...rows.map((r) => keys.map((k) => cell(r[k])).join(',')),
  ];
  return lines.join('\n') + '\n';
}

const ZERO = new Prisma.Decimal(0);
const TENDER_LABEL: Record<string, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  BKASH: 'Mobile Banking',
};

/** Column order of the per-store sheets (also the header of an empty sheet). */
export const SALES_SHEET_COLUMNS = [
  'date',
  'time',
  'receipt',
  'store',
  'cashier',
  'customer',
  'phone',
  'product',
  'variant',
  'sku',
  'qty',
  'unitPrice',
  'lineTotal',
  'saleTotal',
  'payment',
  'trxRef',
  'status',
];
export const CUSTOMER_SHEET_COLUMNS = [
  'name',
  'phone',
  'email',
  'purchases',
  'items',
  'totalSpent',
  'firstPurchase',
  'lastPurchase',
];
export const PROFIT_COLUMNS = [
  'storeId',
  'storeName',
  'gross',
  'returns',
  'vat',
  'netSales',
  'expenses',
  'profit',
];

/** Human column names for the Excel sheets. */
export const SHEET_HEADERS: Record<string, string> = {
  date: 'Date',
  time: 'Time',
  receipt: 'Receipt no',
  store: 'Store',
  cashier: 'Cashier',
  customer: 'Customer',
  phone: 'Phone',
  product: 'Product',
  variant: 'Variant',
  sku: 'SKU',
  qty: 'Qty',
  unitPrice: 'Unit price',
  lineTotal: 'Line total',
  saleTotal: 'Sale total',
  payment: 'Payment',
  trxRef: 'Trx / slip ref',
  status: 'Status',
  name: 'Name',
  email: 'Email',
  purchases: 'Purchases',
  items: 'Items bought',
  totalSpent: 'Total spent',
  firstPurchase: 'First purchase',
  lastPurchase: 'Last purchase',
  storeId: 'Store id',
  storeName: 'Store',
  gross: 'Gross sales',
  returns: 'Returns',
  vat: 'VAT',
  netSales: 'Net sales',
  expenses: 'Expenses',
  profit: 'Profit',
};

@Injectable()
export class PosReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: PosCatalogService,
  ) {}

  /** POS sales per store for [from, to] inclusive. scope null = every store. */
  async sales(scope: number | null, from: string, to: string) {
    const range = dhakaRange(from, to);
    const base: Prisma.OrderWhereInput = {
      channel: 'POS',
      ...(scope ? { storeId: scope } : {}),
    };
    const [sold, returned, stores] = await Promise.all([
      // Gross: every sale made in the range, including ones returned later.
      this.prisma.client.order.groupBy({
        by: ['storeId'],
        where: { ...base, createdAt: range, status: { not: 'CANCELED' } },
        _count: true,
        _sum: { totalAmount: true, taxAmount: true },
      }),
      // Returns: money that went back out on the days in range.
      this.prisma.client.order.groupBy({
        by: ['storeId'],
        where: {
          ...base,
          returnedAt: range,
          status: { in: ['RETURNED', 'PARTIALLY_RETURNED'] },
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.client.store.findMany({ select: { id: true, name: true } }),
    ]);
    const name = new Map(stores.map((s) => [s.id, s.name]));
    const ret = new Map(returned.map((r) => [r.storeId, r._sum.totalAmount]));
    const soldBy = new Map(sold.map((r) => [r.storeId, r]));
    // Every store with sales OR returns in the period — a store whose only
    // activity was a return must still show that money going out.
    const ids = [...new Set([...soldBy.keys(), ...ret.keys()])];
    return ids.map((id) => {
      const r = soldBy.get(id);
      return {
        storeId: id,
        storeName: (id !== null && name.get(id)) || '',
        orders: r?._count ?? 0,
        gross: (r?._sum.totalAmount ?? ZERO).toFixed(2),
        vat: (r?._sum.taxAmount ?? ZERO).toFixed(2),
        returns: (ret.get(id) ?? ZERO).toFixed(2),
      };
    });
  }

  /**
   * Store profit for [from, to] (Dhaka days): gross − returns − VAT on what
   * was kept, minus the expenses booked to each store's cost centre (net of
   * VAT, same basis). No cost of goods — POS stock-in costs aren't a ledger yet.
   */
  async profit(scope: number | null, from: string, to: string) {
    const range = dhakaRange(from, to);
    const base: Prisma.OrderWhereInput = {
      channel: 'POS',
      ...(scope ? { storeId: scope } : {}),
    };
    const stores = await this.prisma.client.store.findMany({
      where: scope ? { id: scope } : {},
      select: { id: true, name: true, costCentreId: true },
    });
    const [sold, returned, expenses] = await Promise.all([
      this.prisma.client.order.groupBy({
        by: ['storeId'],
        where: { ...base, createdAt: range, status: { not: 'CANCELED' } },
        _count: true,
        _sum: { totalAmount: true, taxAmount: true },
      }),
      this.prisma.client.order.groupBy({
        by: ['storeId'],
        where: {
          ...base,
          returnedAt: range,
          status: { in: ['RETURNED', 'PARTIALLY_RETURNED'] },
        },
        _sum: { totalAmount: true, taxAmount: true },
      }),
      this.prisma.client.expense.groupBy({
        by: ['costCentreId'],
        where: {
          voidedAt: null,
          costCentreId: {
            in: stores
              .map((s) => s.costCentreId)
              .filter((id): id is number => id !== null),
          },
          // expense_date is a DATE column: compare calendar days directly.
          expenseDate: {
            gte: new Date(`${from}T00:00:00.000Z`),
            lte: new Date(`${to}T00:00:00.000Z`),
          },
        },
        _sum: { netAmount: true },
      }),
    ]);
    const soldBy = new Map(sold.map((r) => [r.storeId, r._sum]));
    const retBy = new Map(returned.map((r) => [r.storeId, r._sum]));
    const expBy = new Map(
      expenses.map((r) => [r.costCentreId, r._sum.netAmount ?? ZERO]),
    );
    return stores
      .map((s) => {
        const gross = soldBy.get(s.id)?.totalAmount ?? ZERO;
        const returns = retBy.get(s.id)?.totalAmount ?? ZERO;
        const vat = (soldBy.get(s.id)?.taxAmount ?? ZERO).minus(
          retBy.get(s.id)?.taxAmount ?? ZERO,
        );
        const netSales = gross.minus(returns).minus(vat);
        const exp =
          (s.costCentreId !== null && expBy.get(s.costCentreId)) || ZERO;
        return {
          storeId: s.id,
          storeName: s.name,
          gross: gross.toFixed(2),
          returns: returns.toFixed(2),
          vat: vat.toFixed(2),
          netSales: netSales.toFixed(2),
          expenses: exp.toFixed(2),
          profit: netSales.minus(exp).toFixed(2),
        };
      })
      .filter(
        (r) =>
          scope !== null ||
          r.gross !== '0.00' ||
          r.expenses !== '0.00' ||
          r.returns !== '0.00',
      );
  }

  /** One row per sale line — the store's sales sheet. */
  async salesLines(storeId: number, from: string, to: string) {
    const orders = await this.prisma.client.order.findMany({
      where: { channel: 'POS', storeId, createdAt: dhakaRange(from, to) },
      orderBy: { createdAt: 'asc' },
      include: {
        store: { select: { name: true } },
        assignedAdmin: { select: { firstName: true, lastName: true } },
        customer: { select: { firstName: true, lastName: true, phone: true } },
        payments: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { provider: true, transactionRef: true },
        },
        items: {
          include: {
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
      },
    });
    return orders.flatMap((o) =>
      o.items.map((i) => ({
        date: dhakaDate(o.createdAt),
        time: o.createdAt.toLocaleTimeString('en-GB', {
          timeZone: 'Asia/Dhaka',
          hour: '2-digit',
          minute: '2-digit',
        }),
        receipt: o.orderNumber,
        store: o.store?.name ?? '',
        cashier: o.assignedAdmin
          ? `${o.assignedAdmin.firstName} ${o.assignedAdmin.lastName}`.trim()
          : '',
        customer: o.customer
          ? [o.customer.firstName, o.customer.lastName]
              .filter(Boolean)
              .join(' ')
          : '',
        phone: o.customer?.phone ?? '',
        product: i.productNameSnapshot,
        variant:
          i.variant?.attributeValues
            .map((a) => a.attributeValue.translations[0]?.value)
            .filter(Boolean)
            .join(' / ') ?? '',
        sku: i.skuSnapshot ?? '',
        qty: i.quantity,
        unitPrice: new Prisma.Decimal(i.unitPrice).toFixed(2),
        lineTotal: new Prisma.Decimal(i.unitPrice).times(i.quantity).toFixed(2),
        saleTotal: new Prisma.Decimal(o.totalAmount).toFixed(2),
        payment:
          TENDER_LABEL[o.payments[0]?.provider ?? ''] ??
          o.payments[0]?.provider ??
          '',
        trxRef: o.payments[0]?.transactionRef ?? '',
        status: o.status,
      })),
    );
  }

  /** One row per customer who bought at the store — returns and walk-ins excluded. */
  async customers(storeId: number, from: string, to: string) {
    const orders = await this.prisma.client.order.findMany({
      where: {
        channel: 'POS',
        storeId,
        createdAt: dhakaRange(from, to),
        customerId: { not: null },
        status: { not: 'CANCELED' },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        customerId: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        items: { select: { quantity: true } },
        customer: {
          select: { firstName: true, lastName: true, phone: true, email: true },
        },
      },
    });
    const by = new Map<
      number,
      {
        name: string;
        phone: string;
        email: string;
        purchases: number;
        items: number;
        total: Prisma.Decimal;
        first: Date;
        last: Date;
      }
    >();
    for (const o of orders) {
      if (!o.customerId || !o.customer || o.status === 'RETURNED') continue;
      const c = by.get(o.customerId) ?? {
        name:
          [o.customer.firstName, o.customer.lastName]
            .filter(Boolean)
            .join(' ') || 'Customer',
        phone: o.customer.phone ?? '',
        email: o.customer.email ?? '',
        purchases: 0,
        items: 0,
        total: ZERO,
        first: o.createdAt,
        last: o.createdAt,
      };
      c.purchases += 1;
      c.items += o.items.reduce((s, i) => s + i.quantity, 0);
      c.total = c.total.plus(o.totalAmount);
      c.last = o.createdAt;
      by.set(o.customerId, c);
    }
    return [...by.values()]
      .sort((a, b) => b.total.comparedTo(a.total))
      .map((c) => ({
        name: c.name,
        phone: c.phone,
        email: c.email,
        purchases: c.purchases,
        items: c.items,
        totalSpent: c.total.toFixed(2),
        firstPurchase: dhakaDate(c.first),
        lastPurchase: dhakaDate(c.last),
      }));
  }

  async stock(storeId: number) {
    const items = await this.catalog.list(
      storeId,
      undefined,
      undefined,
      'name',
      10_000,
    );
    return items.map((p) => ({
      productId: p.productId,
      variantId: p.variantId,
      name: p.variantLabel ? `${p.name} (${p.variantLabel})` : p.name,
      sku: p.sku,
      barcode: p.barcode,
      quantity: p.stock,
    }));
  }
}
