import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { Prisma, DuePartyType, DueStatus } from '@amader/db';
import { PaginatedResult } from '@amader/shared';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { paginationArgs, toPaginatedResult } from '../../../common/pagination.util';
import { NetProfitSettingsService } from '../settings/net-profit-settings.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpenseQueryDto } from './dto/expense-query.dto';
import { CreateDueDto } from './dto/create-due.dto';
import { DueQueryDto } from './dto/due-query.dto';
import { ExpenseDto, toExpenseDto, DueDto, toDueDto } from './accounts.mapper';
import { resolveZoneFee } from '../../shipping-zones/shipping-zones.matcher';
import { ShippingZonesConfig } from '../../shipping-zones/shipping-zones.types';

const Decimal = Prisma.Decimal;

export interface VatSettings {
  enabled: boolean;
  ratePercent: number;
  binNumber: string;
}

// 15% is the standard NBR VAT rate for most goods in Bangladesh — a sane
// e-commerce default, editable per-store in Settings. Exported so
// CheckoutService can apply the exact same rate to real orders instead of
// this being a reporting-only figure divorced from what customers actually
// pay (see checkout.service.ts).
export const VAT_DEFAULTS: VatSettings = { enabled: true, ratePercent: 15, binNumber: '' };

export interface CodFeeSettings {
  enabled: boolean;
  percent: number;
}

// Off by default — a COD surcharge changes what real customers pay, so it
// shouldn't switch on silently the moment this code ships. Admin opts in
// from the same VAT & Cash Flow tab (Settings > Accounts).
export const COD_FEE_DEFAULTS: CodFeeSettings = { enabled: false, percent: 1 };

// Checkout-time shipping fee. The Dhaka-vs-everywhere-else split this used
// to hardcode is now admin-editable shipping zones (Shipments > Shipping
// Rates); the shipped defaults reproduce the old 80/120 exactly, so nothing
// changes until an admin edits a zone. This is what's actually charged to
// the customer at order placement; ShipmentsService.dispatch() later
// separately overwrites both shippingAmount and totalAmount with the real
// courier cost (see ShippingChargeCalculator, which does its own similar
// Dhaka-vs-not split for that unrelated number).

// Single source of truth for the shipping-fee math — used by CheckoutService
// when actually placing an order AND by CartService's checkout-preview
// pricing, so what the customer sees on the checkout page can never drift
// from what they're actually charged. `district` is optional because the
// preview can be requested before the customer has typed an address yet;
// resolveZoneFee then quotes the first zone, preserving the old behaviour of
// previewing the cheap Dhaka rate until a real district is known.
//
// `zones` is passed in rather than fetched here so this stays a pure,
// directly-testable function — the callers own the DB read.
export function computeCheckoutFees(
  freeShipping: boolean,
  district: string | undefined,
  zones: ShippingZonesConfig,
): { shippingFee: Prisma.Decimal } {
  if (freeShipping) return { shippingFee: new Decimal(0) };
  return { shippingFee: new Decimal(resolveZoneFee(zones, district).fee) };
}

export interface VatSummary {
  outputVat: string;
  inputVat: string;
  netPayable: string;
  revenue: string;
  ratePercent: number;
}

export interface CashFlowEntry {
  date: Date;
  type: 'SALE' | 'DUE_RECEIVED' | 'EXPENSE' | 'DUE_PAID' | 'REFUND';
  description: string;
  amount: string; // positive = cash in, negative = cash out
}

export interface CashFlowSummary {
  cashIn: string;
  cashOut: string;
  net: string;
  entries: CashFlowEntry[];
}

export interface AccountsOverview {
  revenue: string;
  totalExpenses: string;
  vatPayable: string;
  netCashFlow: string;
  customerDueOutstanding: string;
  supplierDueOutstanding: string;
}

function dateRange(from?: string, to?: string): { gte?: Date; lte?: Date } {
  return {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to ? { lte: new Date(to + 'T23:59:59.999Z') } : {}),
  };
}

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: NetProfitSettingsService,
  ) {}

  // --- Expenses -----------------------------------------------------------

  async listExpenses(query: ExpenseQueryDto): Promise<PaginatedResult<ExpenseDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.ExpenseWhereInput = {
      ...(query.category ? { category: query.category } : {}),
      ...((query.from || query.to) ? { expenseDate: dateRange(query.from, query.to) } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.expense.findMany({ where, orderBy: { expenseDate: 'desc' }, ...paginationArgs(page, pageSize) }),
      this.prisma.client.expense.count({ where }),
    ]);
    return toPaginatedResult(items.map(toExpenseDto), total, page, pageSize);
  }

  async createExpense(dto: CreateExpenseDto, adminId: number): Promise<ExpenseDto> {
    const row = await this.prisma.client.expense.create({
      data: {
        expenseDate: new Date(dto.expenseDate),
        category: dto.category,
        amount: new Decimal(dto.amount),
        isVatInput: dto.isVatInput ?? false,
        note: dto.note,
        createdBy: adminId,
      },
    });
    return toExpenseDto(row);
  }

  async updateExpense(id: number, dto: UpdateExpenseDto): Promise<ExpenseDto> {
    const row = await this.prisma.client.expense.update({
      where: { id },
      data: {
        ...(dto.expenseDate !== undefined ? { expenseDate: new Date(dto.expenseDate) } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.amount !== undefined ? { amount: new Decimal(dto.amount) } : {}),
        ...(dto.isVatInput !== undefined ? { isVatInput: dto.isVatInput } : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
      },
    });
    return toExpenseDto(row);
  }

  async deleteExpense(id: number): Promise<void> {
    await this.prisma.client.expense.delete({ where: { id } });
  }

  // --- Dues -----------------------------------------------------------------

  async listDues(query: DueQueryDto): Promise<PaginatedResult<DueDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.DueWhereInput = {
      ...(query.partyType ? { partyType: query.partyType } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.due.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginationArgs(page, pageSize) }),
      this.prisma.client.due.count({ where }),
    ]);
    return toPaginatedResult(items.map(toDueDto), total, page, pageSize);
  }

  async createDue(dto: CreateDueDto, adminId: number): Promise<DueDto> {
    const row = await this.prisma.client.due.create({
      data: {
        partyType: dto.partyType,
        partyName: dto.partyName,
        customerId: dto.customerId,
        amount: new Decimal(dto.amount),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        note: dto.note,
        createdBy: adminId,
      },
    });
    return toDueDto(row);
  }

  // ponytail: paidAmount is a running total on the Due row itself, not a
  // per-payment log — cash-flow timing below uses `updatedAt` as a proxy for
  // "when money moved." Fine for a due book at this scale; if per-payment
  // history matters later, add a DuePayment child table and sum from that.
  async recordDuePayment(id: number, amount: number): Promise<DueDto> {
    const due = await this.prisma.client.due.findUnique({ where: { id } });
    if (!due) throw new NotFoundException('Due not found');
    const paidAmount = due.paidAmount.plus(amount);
    if (paidAmount.greaterThan(due.amount)) {
      throw new BadRequestException('Payment exceeds the remaining due amount');
    }
    const status: DueStatus = paidAmount.greaterThanOrEqualTo(due.amount)
      ? 'PAID'
      : paidAmount.greaterThan(0)
        ? 'PARTIALLY_PAID'
        : 'PENDING';
    const row = await this.prisma.client.due.update({ where: { id }, data: { paidAmount, status } });
    return toDueDto(row);
  }

  async deleteDue(id: number): Promise<void> {
    await this.prisma.client.due.delete({ where: { id } });
  }

  // --- VAT --------------------------------------------------------------

  async getVatSettings(): Promise<VatSettings> {
    return this.settings.getNamespace('accounts_vat', VAT_DEFAULTS);
  }

  async updateVatSettings(dto: Partial<VatSettings>): Promise<VatSettings> {
    await this.settings.setNamespace('accounts_vat', dto);
    return this.getVatSettings();
  }

  async getCodFeeSettings(): Promise<CodFeeSettings> {
    return this.settings.getNamespace('cod_fee', COD_FEE_DEFAULTS);
  }

  async updateCodFeeSettings(dto: Partial<CodFeeSettings>): Promise<CodFeeSettings> {
    await this.settings.setNamespace('cod_fee', dto);
    return this.getCodFeeSettings();
  }

  private async revenueInRange(from?: string, to?: string): Promise<Prisma.Decimal> {
    const agg = await this.prisma.client.order.aggregate({
      where: { status: 'COMPLETED', completedAt: dateRange(from, to) },
      _sum: { totalAmount: true },
    });
    return agg._sum.totalAmount ?? new Decimal(0);
  }

  async vatSummary(from?: string, to?: string): Promise<VatSummary> {
    const vat = await this.getVatSettings();
    const revenue = await this.revenueInRange(from, to);
    const rate = new Decimal(vat.ratePercent).dividedBy(100);

    // Per explicit request, tax is purely an internal accounting figure —
    // no real order ever carries a nonzero taxAmount (see
    // computeCheckoutFees's own comment), so output VAT is estimated from
    // revenue × rate here instead of summing a per-order field that's
    // always 0. This is a reversion: an earlier version of this summary did
    // sum real Order.taxAmount, back when checkout actually charged it.
    const outputVat = revenue.times(rate);

    const inputExpenses = await this.prisma.client.expense.aggregate({
      where: { isVatInput: true, ...((from || to) ? { expenseDate: dateRange(from, to) } : {}) },
      _sum: { amount: true },
    });
    const inputBase = inputExpenses._sum.amount ?? new Decimal(0);
    const inputVat = inputBase.times(rate);

    return {
      outputVat: outputVat.toFixed(2),
      inputVat: inputVat.toFixed(2),
      netPayable: outputVat.minus(inputVat).toFixed(2),
      revenue: revenue.toFixed(2),
      ratePercent: vat.ratePercent,
    };
  }

  // --- Cash flow ----------------------------------------------------------

  async cashFlow(from?: string, to?: string): Promise<CashFlowSummary> {
    const range = dateRange(from, to);

    const [orders, expenses, duesReceived, duesPaid, refunds] = await Promise.all([
      this.prisma.client.order.findMany({
        where: { status: 'COMPLETED', completedAt: range },
        select: { id: true, orderNumber: true, totalAmount: true, completedAt: true },
        orderBy: { completedAt: 'asc' },
      }),
      this.prisma.client.expense.findMany({
        where: (from || to) ? { expenseDate: range } : {},
        orderBy: { expenseDate: 'asc' },
      }),
      this.prisma.client.due.findMany({
        where: { partyType: 'CUSTOMER', paidAmount: { gt: 0 }, ...((from || to) ? { updatedAt: range } : {}) },
        orderBy: { updatedAt: 'asc' },
      }),
      this.prisma.client.due.findMany({
        where: { partyType: 'SUPPLIER', paidAmount: { gt: 0 }, ...((from || to) ? { updatedAt: range } : {}) },
        orderBy: { updatedAt: 'asc' },
      }),
      this.prisma.client.payment.findMany({
        where: { refundedAmount: { not: null }, ...((from || to) ? { updatedAt: range } : {}) },
        include: { order: { select: { orderNumber: true } } },
        orderBy: { updatedAt: 'asc' },
      }),
    ]);

    const entries: CashFlowEntry[] = [
      ...orders.map((o) => ({
        date: o.completedAt!,
        type: 'SALE' as const,
        description: `Order ${o.orderNumber}`,
        amount: o.totalAmount.toString(),
      })),
      ...duesReceived.map((d) => ({
        date: d.updatedAt,
        type: 'DUE_RECEIVED' as const,
        description: `Due received — ${d.partyName}`,
        amount: d.paidAmount.toString(),
      })),
      ...expenses.map((e) => ({
        date: e.expenseDate,
        type: 'EXPENSE' as const,
        description: `${e.category}${e.note ? ` — ${e.note}` : ''}`,
        amount: new Decimal(0).minus(e.amount).toString(),
      })),
      ...duesPaid.map((d) => ({
        date: d.updatedAt,
        type: 'DUE_PAID' as const,
        description: `Due paid — ${d.partyName}`,
        amount: new Decimal(0).minus(d.paidAmount).toString(),
      })),
      ...refunds.map((p) => ({
        date: p.updatedAt,
        type: 'REFUND' as const,
        description: `Refund — ${p.order.orderNumber}`,
        amount: new Decimal(0).minus(p.refundedAmount ?? 0).toString(),
      })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    const cashIn = entries.filter((e) => Number(e.amount) > 0).reduce((sum, e) => sum.plus(e.amount), new Decimal(0));
    const cashOut = entries.filter((e) => Number(e.amount) < 0).reduce((sum, e) => sum.plus(e.amount), new Decimal(0)).abs();

    return {
      cashIn: cashIn.toFixed(2),
      cashOut: cashOut.toFixed(2),
      net: cashIn.minus(cashOut).toFixed(2),
      entries,
    };
  }

  // --- Overview -------------------------------------------------------------

  async overview(from?: string, to?: string): Promise<AccountsOverview> {
    const [revenue, expenseAgg, vat, flow, customerDue, supplierDue] = await Promise.all([
      this.revenueInRange(from, to),
      this.prisma.client.expense.aggregate({
        where: (from || to) ? { expenseDate: dateRange(from, to) } : {},
        _sum: { amount: true },
      }),
      this.vatSummary(from, to),
      this.cashFlow(from, to),
      this.prisma.client.due.aggregate({
        where: { partyType: 'CUSTOMER', status: { not: 'PAID' } },
        _sum: { amount: true, paidAmount: true },
      }),
      this.prisma.client.due.aggregate({
        where: { partyType: 'SUPPLIER', status: { not: 'PAID' } },
        _sum: { amount: true, paidAmount: true },
      }),
    ]);

    const outstanding = (agg: { _sum: { amount: Prisma.Decimal | null; paidAmount: Prisma.Decimal | null } }) =>
      (agg._sum.amount ?? new Decimal(0)).minus(agg._sum.paidAmount ?? new Decimal(0)).toFixed(2);

    return {
      revenue: revenue.toFixed(2),
      totalExpenses: (expenseAgg._sum.amount ?? new Decimal(0)).toFixed(2),
      vatPayable: vat.netPayable,
      netCashFlow: flow.net,
      customerDueOutstanding: outstanding(customerDue),
      supplierDueOutstanding: outstanding(supplierDue),
    };
  }

  // --- Excel export -------------------------------------------------------

  async exportExcel(kind: 'expenses' | 'dues' | 'cashflow', from?: string, to?: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Amader Admin';
    workbook.created = new Date();

    if (kind === 'expenses') {
      const { items } = await this.listExpenses({ page: 1, pageSize: 10000, from, to });
      const sheet = workbook.addWorksheet('Expenses');
      sheet.columns = [
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Category', key: 'category', width: 24 },
        { header: 'Amount (BDT)', key: 'amount', width: 16 },
        { header: 'VAT Input', key: 'vat', width: 12 },
        { header: 'Note', key: 'note', width: 40 },
      ];
      sheet.addRows(items.map((e) => ({
        date: e.expenseDate.toISOString().slice(0, 10),
        category: e.category,
        amount: Number(e.amount),
        vat: e.isVatInput ? 'Yes' : 'No',
        note: e.note ?? '',
      })));
    } else if (kind === 'dues') {
      const { items } = await this.listDues({ page: 1, pageSize: 10000 });
      const sheet = workbook.addWorksheet('Dues');
      sheet.columns = [
        { header: 'Party Type', key: 'partyType', width: 14 },
        { header: 'Party Name', key: 'partyName', width: 28 },
        { header: 'Amount (BDT)', key: 'amount', width: 16 },
        { header: 'Paid (BDT)', key: 'paid', width: 16 },
        { header: 'Remaining (BDT)', key: 'remaining', width: 16 },
        { header: 'Status', key: 'status', width: 16 },
        { header: 'Due Date', key: 'dueDate', width: 14 },
      ];
      sheet.addRows(items.map((d) => ({
        partyType: d.partyType,
        partyName: d.partyName,
        amount: Number(d.amount),
        paid: Number(d.paidAmount),
        remaining: Number(d.remaining),
        status: d.status,
        dueDate: d.dueDate ? d.dueDate.toISOString().slice(0, 10) : '',
      })));
    } else {
      const flow = await this.cashFlow(from, to);
      const sheet = workbook.addWorksheet('Cash Flow');
      sheet.columns = [
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Type', key: 'type', width: 16 },
        { header: 'Description', key: 'description', width: 40 },
        { header: 'Amount (BDT)', key: 'amount', width: 16 },
      ];
      sheet.addRows(flow.entries.map((e) => ({
        date: e.date.toISOString().slice(0, 10),
        type: e.type,
        description: e.description,
        amount: Number(e.amount),
      })));
      sheet.addRow({});
      sheet.addRow({ description: 'Cash In', amount: Number(flow.cashIn) });
      sheet.addRow({ description: 'Cash Out', amount: -Number(flow.cashOut) });
      sheet.addRow({ description: 'Net', amount: Number(flow.net) });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
