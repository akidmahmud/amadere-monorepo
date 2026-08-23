import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@amader/db';
import { ReportsService } from './reports.service';
import { LedgerService } from '../ledger/ledger.service';
import { DuesService } from '../dues/dues.service';
import { ExpensesService } from '../expenses/expenses.service';
import { CashAccountsService } from '../cash-accounts/cash-accounts.service';
import { CodSettlementService } from '../cod/cod-settlement.service';
import { VatService } from '../vat/vat.service';
import { AccountsSettingsService } from '../accounts-settings.service';
import { PrismaService } from '../../../../common/prisma/prisma.service';

const D = (v: string | number) => new Prisma.Decimal(v);

const emptyAgeing = {
  kind: 'RECEIVABLE',
  buckets: {
    CURRENT: { count: 0, amount: '0.00' },
    '1_30': { count: 0, amount: '0.00' },
    '31_60': { count: 0, amount: '0.00' },
    '60_PLUS': { count: 0, amount: '0.00' },
  },
  total: '0.00',
  overdue: '0.00',
  averageAgeDays: 0,
};

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: { client: Record<string, Record<string, jest.Mock>> };
  let ledger: { accountBalance: jest.Mock; accountBalances: jest.Mock };
  let dues: { ageing: jest.Mock; list: jest.Mock };
  let expenses: { list: jest.Mock };
  let cashAccounts: { list: jest.Mock };
  let cod: { pending: jest.Mock };
  let vat: { vatReturn: jest.Mock; atRisk: jest.Mock };
  let settings: { getPostingSettings: jest.Mock };

  beforeEach(async () => {
    prisma = {
      client: {
        order: { aggregate: jest.fn().mockResolvedValue({ _sum: { totalAmount: D('5000.00') } }) },
        expense: {
          aggregate: jest.fn().mockResolvedValue({ _sum: { netAmount: D('1200.00') } }),
          groupBy: jest.fn().mockResolvedValue([]),
        },
        expenseCategory: { findMany: jest.fn().mockResolvedValue([]) },
        ledgerEntry: { findMany: jest.fn().mockResolvedValue([]) },
      },
    };
    ledger = {
      accountBalance: jest.fn().mockResolvedValue(D('1000.00')),
      // Batched: four queries for the whole cash-flow table rather than two
      // per account.
      accountBalances: jest.fn().mockResolvedValue(new Map()),
    };
    dues = {
      ageing: jest.fn().mockResolvedValue(emptyAgeing),
      list: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10000 }),
    };
    expenses = {
      list: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10000 }),
    };
    cashAccounts = {
      list: jest.fn().mockResolvedValue([
        { id: 1, name: 'bKash', type: 'MOBILE_WALLET', openingBalance: '1000.00', balance: '1300.00' },
      ]),
    };
    cod = { pending: jest.fn().mockResolvedValue([]) };
    vat = {
      vatReturn: jest.fn().mockResolvedValue({ netPayable: '0.00' }),
      atRisk: jest.fn().mockResolvedValue([]),
    };
    settings = { getPostingSettings: jest.fn().mockResolvedValue({ defaultCashAccountId: 2 }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: LedgerService, useValue: ledger },
        { provide: DuesService, useValue: dues },
        { provide: ExpensesService, useValue: expenses },
        { provide: CashAccountsService, useValue: cashAccounts },
        { provide: CodSettlementService, useValue: cod },
        { provide: VatService, useValue: vat },
        { provide: AccountsSettingsService, useValue: settings },
      ],
    }).compile();
    service = module.get(ReportsService);
  });

  describe('cashFlowByAccount', () => {
    it('reports opening, in, out and closing per account', async () => {
      ledger.accountBalances
        .mockResolvedValueOnce(new Map([[1, D('1000.00')]]))  // opening
        .mockResolvedValueOnce(new Map([[1, D('1300.00')]])); // closing
      prisma.client.ledgerEntry.findMany.mockResolvedValue([
        { accountId: 1, direction: 'IN', amount: D('500.00') },
        { accountId: 1, direction: 'OUT', amount: D('200.00') },
      ]);

      const rows = await service.cashFlowByAccount('2026-08-01', '2026-08-31');

      expect(rows[0]).toMatchObject({
        name: 'bKash', opening: '1000.00', moneyIn: '500.00', moneyOut: '200.00', closing: '1300.00',
      });
    });

    it('only counts recorded ledger entries — an unpaid expense moves nothing (defect D2)', async () => {
      ledger.accountBalances.mockResolvedValue(new Map([[1, D('0.00')]]));
      prisma.client.ledgerEntry.findMany.mockResolvedValue([]);
      const rows = await service.cashFlowByAccount('2026-08-01', '2026-08-31');
      expect(rows[0].moneyOut).toBe('0.00');
      expect(rows[0].moneyIn).toBe('0.00');
    });
  });

  describe('exportExcel — defect D5', () => {
    it('passes the caller query through to the dues list instead of dumping everything', async () => {
      await service.exportExcel('dues', { kind: 'PAYABLE', from: '2026-08-01', to: '2026-08-31' });
      expect(dues.list).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'PAYABLE', from: '2026-08-01', to: '2026-08-31' }),
      );
    });

    it('passes the caller query through to the expense list', async () => {
      await service.exportExcel('expenses', { categoryId: 3 });
      expect(expenses.list).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 3 }));
    });

    it('returns a non-empty workbook buffer', async () => {
      const buf = await service.exportExcel('expenses', {});
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(0);
    });

    it('exports the cash flow without needing a list query', async () => {
      const buf = await service.exportExcel('cashflow', { from: '2026-08-01', to: '2026-08-31' });
      expect(buf.length).toBeGreaterThan(0);
    });
  });

  describe('overview', () => {
    it('raises an alert for input VAT at risk', async () => {
      vat.atRisk.mockResolvedValue([{ expenseId: 1, vatAmount: '300.00' }]);
      const o = await service.overview();
      expect(o.alerts.some((a) => /rebate|challan/i.test(a.message))).toBe(true);
    });

    it('raises an alert when no default cash account is configured', async () => {
      // Prepaid captures silently post nothing while this is unset, so the
      // gap has to be visible somewhere.
      settings.getPostingSettings.mockResolvedValue({ defaultCashAccountId: null });
      const o = await service.overview();
      expect(o.alerts.some((a) => /cash account/i.test(a.message))).toBe(true);
    });

    it('reports COD with courier from unsettled shipments', async () => {
      cod.pending.mockResolvedValue([{ codCollected: '82000.00', courierCharges: '4000.00' }]);
      expect((await service.overview()).codWithCourier).toBe('82000.00');
    });

    it('sums cash in hand across all accounts', async () => {
      cashAccounts.list.mockResolvedValue([
        { id: 1, name: 'bKash', type: 'MOBILE_WALLET', openingBalance: '0.00', balance: '1300.00' },
        { id: 2, name: 'Bank', type: 'BANK', openingBalance: '0.00', balance: '700.00' },
      ]);
      expect((await service.overview()).cashInHand).toBe('2000.00');
    });

    it('raises an alert for overdue receivables', async () => {
      dues.ageing.mockResolvedValue({ ...emptyAgeing, overdue: '5000.00' });
      const o = await service.overview();
      expect(o.alerts.some((a) => /overdue/i.test(a.message))).toBe(true);
    });

    it('says nothing needs attention when everything is clean', async () => {
      const o = await service.overview();
      expect(o.alerts).toEqual([]);
    });
  });
});
