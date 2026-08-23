import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { Prisma } from '@amader/db';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { DuesService } from '../dues/dues.service';
import { ExpensesService } from '../expenses/expenses.service';
import { CashAccountsService } from '../cash-accounts/cash-accounts.service';
import { CodSettlementService } from '../cod/cod-settlement.service';
import { VatService } from '../vat/vat.service';
import { AccountsSettingsService } from '../accounts-settings.service';

const Decimal = Prisma.Decimal;
const ZERO = new Decimal(0);

export type AlertSeverity = 'INFO' | 'WARN' | 'DANGER';

export interface AccountsAlert {
  severity: AlertSeverity;
  message: string;
}

export interface AccountsOverview {
  sales: string;
  expenses: string;
  receivable: string;
  payable: string;
  cashInHand: string;
  codWithCourier: string;
  spendByCategory: { category: string; amount: string }[];
  alerts: AccountsAlert[];
}

export interface CashFlowRow {
  accountId: number;
  name: string;
  type: string;
  opening: string;
  moneyIn: string;
  moneyOut: string;
  closing: string;
}

export type ExportKind = 'expenses' | 'dues' | 'cashflow' | 'ledger';

/**
 * Read-only reporting over the ledger.
 *
 * Every export delegates to the owning service's list() with the caller's own
 * query object, so an export and the screen it was launched from can never
 * disagree. The previous implementation called listDues() with no query at
 * all, meaning the dues export always dumped everything regardless of the
 * filters on screen.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly dues: DuesService,
    private readonly expenses: ExpensesService,
    private readonly cashAccounts: CashAccountsService,
    private readonly cod: CodSettlementService,
    private readonly vat: VatService,
    private readonly settings: AccountsSettingsService,
  ) {}

  private dateRange(from?: string, to?: string) {
    return {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
    };
  }

  async cashFlowByAccount(from?: string, to?: string): Promise<CashFlowRow[]> {
    const accounts = await this.cashAccounts.list();
    const entries = await this.prisma.client.ledgerEntry.findMany({
      where: from || to ? { entryDate: this.dateRange(from, to) } : {},
      select: { accountId: true, direction: true, amount: true },
    });

    const dayBefore = from ? new Date(new Date(from).getTime() - 86_400_000) : undefined;

    // Four queries total instead of two per account.
    const [openings, closings] = await Promise.all([
      this.ledger.accountBalances(dayBefore),
      this.ledger.accountBalances(to ? new Date(to) : undefined),
    ]);

    const rows: CashFlowRow[] = [];
    for (const account of accounts) {
      const mine = entries.filter((e) => e.accountId === account.id);
      const moneyIn = mine
        .filter((e) => e.direction === 'IN')
        .reduce((acc, e) => acc.plus(e.amount), new Decimal(0));
      const moneyOut = mine
        .filter((e) => e.direction === 'OUT')
        .reduce((acc, e) => acc.plus(e.amount), new Decimal(0));

      const opening = openings.get(account.id) ?? ZERO;
      const closing = closings.get(account.id) ?? ZERO;

      rows.push({
        accountId: account.id,
        name: account.name,
        type: account.type,
        opening: opening.toFixed(2),
        moneyIn: moneyIn.toFixed(2),
        moneyOut: moneyOut.toFixed(2),
        closing: closing.toFixed(2),
      });
    }
    return rows;
  }

  async overview(from?: string, to?: string): Promise<AccountsOverview> {
    const [salesAgg, expenseAgg, accounts, arAgeing, apAgeing, pendingCod, atRisk, posting] =
      await Promise.all([
        this.prisma.client.order.aggregate({
          where: {
            status: 'COMPLETED',
            ...(from || to ? { completedAt: this.dateRange(from, to) } : {}),
          },
          _sum: { totalAmount: true },
        }),
        this.prisma.client.expense.aggregate({
          where: {
            voidedAt: null,
            ...(from || to ? { expenseDate: this.dateRange(from, to) } : {}),
          },
          // Net of VAT: input VAT is reclaimable, so counting it as spend
          // overstates what the business actually consumed.
          _sum: { netAmount: true },
        }),
        this.cashAccounts.list(),
        this.dues.ageing('RECEIVABLE'),
        this.dues.ageing('PAYABLE'),
        this.cod.pending(),
        this.vat.atRisk(from, to),
        this.settings.getPostingSettings(),
      ]);

    const cashInHand = accounts.reduce((acc, a) => acc.plus(a.balance), new Decimal(0));
    const codWithCourier = pendingCod.reduce((acc, b) => acc.plus(b.codCollected), new Decimal(0));

    const alerts: AccountsAlert[] = [];
    if (atRisk.length > 0) {
      const total = atRisk.reduce((acc, r) => acc.plus(r.vatAmount), new Decimal(0));
      alerts.push({
        severity: 'WARN',
        message:
          `৳${total.toFixed(2)} of input VAT across ${atRisk.length} voucher(s) is at risk — ` +
          `a missing Mushak 6.3 challan or supplier BIN means the rebate is lost on audit.`,
      });
    }
    if (!posting.defaultCashAccountId) {
      alerts.push({
        severity: 'DANGER',
        message:
          'No default cash account is set, so prepaid sales and refunds are not being posted ' +
          'to the ledger. Set one in Accounts settings.',
      });
    }
    if (new Decimal(arAgeing.overdue).greaterThan(ZERO)) {
      alerts.push({
        severity: 'WARN',
        message: `৳${arAgeing.overdue} of receivables is overdue.`,
      });
    }
    if (new Decimal(apAgeing.overdue).greaterThan(ZERO)) {
      alerts.push({
        severity: 'DANGER',
        message: `৳${apAgeing.overdue} of payables is overdue.`,
      });
    }

    return {
      sales: (salesAgg._sum.totalAmount ?? ZERO).toFixed(2),
      expenses: (expenseAgg._sum.netAmount ?? ZERO).toFixed(2),
      receivable: arAgeing.total,
      payable: apAgeing.total,
      cashInHand: cashInHand.toFixed(2),
      codWithCourier: codWithCourier.toFixed(2),
      spendByCategory: await this.spendByCategory(from, to),
      alerts,
    };
  }

  private async spendByCategory(
    from?: string,
    to?: string,
  ): Promise<{ category: string; amount: string }[]> {
    const grouped = await this.prisma.client.expense.groupBy({
      by: ['categoryId'],
      where: {
        voidedAt: null,
        ...(from || to ? { expenseDate: this.dateRange(from, to) } : {}),
      },
      _sum: { netAmount: true },
    });
    if (grouped.length === 0) return [];

    const categories = await this.prisma.client.expenseCategory.findMany({
      where: { id: { in: grouped.map((g) => g.categoryId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(categories.map((c) => [c.id, c.name]));

    return grouped
      .map((g) => ({
        category: nameById.get(g.categoryId) ?? 'Uncategorised',
        amount: (g._sum.netAmount ?? ZERO).toFixed(2),
      }))
      .sort((a, b) => Number(b.amount) - Number(a.amount));
  }

  async exportExcel(kind: ExportKind, query: Record<string, unknown>): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Amader Admin';
    workbook.created = new Date();

    if (kind === 'expenses') {
      // The caller's own filter object, so the file matches the screen.
      const { items } = await this.expenses.list({ ...query, page: 1, pageSize: 10000 } as never);
      const sheet = workbook.addWorksheet('Expenses');
      sheet.columns = [
        { header: 'Voucher', key: 'voucherNo', width: 18 },
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Category', key: 'category', width: 22 },
        { header: 'Payee', key: 'party', width: 24 },
        { header: 'Cost centre', key: 'costCentre', width: 18 },
        { header: 'Net (BDT)', key: 'net', width: 14 },
        { header: 'VAT (BDT)', key: 'vat', width: 14 },
        { header: 'Gross (BDT)', key: 'gross', width: 14 },
        { header: 'Withheld (BDT)', key: 'withheld', width: 16 },
        { header: 'Net payable (BDT)', key: 'netPayable', width: 18 },
        { header: 'Paid (BDT)', key: 'paid', width: 14 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Mushak 6.3', key: 'challan', width: 18 },
        { header: 'Note', key: 'note', width: 40 },
      ];
      sheet.addRows(
        items.map((e) => ({
          voucherNo: e.voucherNo,
          date: e.expenseDate.toISOString().slice(0, 10),
          category: e.categoryName,
          party: e.partyName,
          costCentre: e.costCentreName ?? '',
          net: Number(e.netAmount),
          vat: Number(e.vatAmount),
          gross: Number(e.grossAmount),
          withheld: Number(e.aitAmount) + Number(e.vdsAmount),
          netPayable: Number(e.netPayable),
          paid: Number(e.paidAmount),
          status: e.paymentStatus,
          challan: e.mushakChallanNo ?? '',
          note: e.note ?? '',
        })),
      );
    } else if (kind === 'dues') {
      const { items } = await this.dues.list({ ...query, page: 1, pageSize: 10000 } as never);
      const sheet = workbook.addWorksheet('Dues');
      sheet.columns = [
        { header: 'Doc no', key: 'docNo', width: 18 },
        { header: 'Kind', key: 'kind', width: 14 },
        { header: 'Party', key: 'party', width: 26 },
        { header: 'Source', key: 'source', width: 18 },
        { header: 'Amount (BDT)', key: 'amount', width: 16 },
        { header: 'Paid (BDT)', key: 'paid', width: 16 },
        { header: 'Remaining (BDT)', key: 'remaining', width: 18 },
        { header: 'Status', key: 'status', width: 16 },
        { header: 'Issue date', key: 'issueDate', width: 14 },
        { header: 'Due date', key: 'dueDate', width: 14 },
        { header: 'Age (days)', key: 'age', width: 12 },
        { header: 'Bucket', key: 'bucket', width: 12 },
      ];
      sheet.addRows(
        items.map((d) => ({
          docNo: d.docNo,
          kind: d.kind,
          party: d.partyName,
          source: d.source,
          amount: Number(d.amount),
          paid: Number(d.paidAmount),
          remaining: Number(d.remaining),
          status: d.status,
          issueDate: d.issueDate.toISOString().slice(0, 10),
          dueDate: d.dueDate ? d.dueDate.toISOString().slice(0, 10) : '',
          age: d.ageDays,
          bucket: d.bucket,
        })),
      );
    } else if (kind === 'cashflow') {
      const rows = await this.cashFlowByAccount(query.from as string, query.to as string);
      const sheet = workbook.addWorksheet('Cash flow');
      sheet.columns = [
        { header: 'Account', key: 'name', width: 24 },
        { header: 'Type', key: 'type', width: 18 },
        { header: 'Opening (BDT)', key: 'opening', width: 16 },
        { header: 'Money in (BDT)', key: 'moneyIn', width: 16 },
        { header: 'Money out (BDT)', key: 'moneyOut', width: 16 },
        { header: 'Closing (BDT)', key: 'closing', width: 16 },
      ];
      sheet.addRows(
        rows.map((r) => ({
          name: r.name,
          type: r.type,
          opening: Number(r.opening),
          moneyIn: Number(r.moneyIn),
          moneyOut: Number(r.moneyOut),
          closing: Number(r.closing),
        })),
      );
    } else {
      const entries = await this.prisma.client.ledgerEntry.findMany({
        where:
          query.from || query.to
            ? { entryDate: this.dateRange(query.from as string, query.to as string) }
            : {},
        include: { account: true, party: true },
        orderBy: [{ entryDate: 'asc' }, { id: 'asc' }],
      });
      const sheet = workbook.addWorksheet('Ledger');
      sheet.columns = [
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Account', key: 'account', width: 22 },
        { header: 'Direction', key: 'direction', width: 12 },
        { header: 'Amount (BDT)', key: 'amount', width: 16 },
        { header: 'Source', key: 'source', width: 22 },
        { header: 'Party', key: 'party', width: 24 },
        { header: 'Reference', key: 'reference', width: 22 },
        { header: 'Note', key: 'note', width: 40 },
      ];
      sheet.addRows(
        entries.map((e) => ({
          date: e.entryDate.toISOString().slice(0, 10),
          account: e.account.name,
          direction: e.direction,
          amount: Number(e.amount),
          source: e.source,
          party: e.party?.name ?? '',
          reference: e.reference ?? '',
          note: e.note ?? '',
        })),
      );
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
