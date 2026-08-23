import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { ExpensesService } from './expenses.service';
import { LedgerService } from '../ledger/ledger.service';
import { DuesService } from '../dues/dues.service';
import { PrismaService } from '../../../../common/prisma/prisma.service';

const D = (v: string | number) => new Prisma.Decimal(v);

describe('ExpensesService', () => {
  let service: ExpensesService;
  let prisma: { client: Record<string, Record<string, jest.Mock>> & { $transaction: jest.Mock; $queryRaw: jest.Mock } };
  let ledger: {
    post: jest.Mock; reverse: jest.Mock; paidForExpense: jest.Mock; paidForExpenses: jest.Mock;
    assertPeriodOpen: jest.Mock;
  };
  let dues: { recordPayment: jest.Mock };

  const tx = {
    expense: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
    },
    due: {
      create: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };

  const savedExpense = {
    id: 42,
    voucherNo: 'EXP-2608-0001',
    expenseDate: new Date('2026-08-12'),
    categoryId: 1,
    costCentreId: null,
    partyId: 3,
    netAmount: D('1000.00'),
    vatRate: D('15.00'),
    vatAmount: D('150.00'),
    grossAmount: D('1150.00'),
    amountIncludesVat: false,
    mushakChallanNo: null,
    aitPercent: D(0),
    aitAmount: D(0),
    vdsPercent: D(0),
    vdsAmount: D(0),
    netPayable: D('1150.00'),
    dueDate: null,
    attachmentUrl: null,
    note: null,
    voidedAt: null,
    category: { id: 1, name: 'Rent' },
    party: { id: 3, name: 'Landlord' },
    costCentre: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    tx.expense.create.mockResolvedValue(savedExpense);
    tx.expense.update.mockResolvedValue({ ...savedExpense, voidedAt: new Date() });
    tx.expense.findUnique.mockResolvedValue(savedExpense);
    tx.expense.findFirst.mockResolvedValue(null);
    tx.due.create.mockResolvedValue({ id: 77 });
    tx.due.findFirst.mockResolvedValue(null);

    const client = {
      expense: {
        findUnique: jest.fn().mockResolvedValue(savedExpense),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      due: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      ledgerEntry: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    prisma = { client } as never;

    ledger = {
      post: jest.fn().mockResolvedValue({ id: 100 }),
      reverse: jest.fn().mockResolvedValue({ id: 101 }),
      paidForExpense: jest.fn().mockResolvedValue(D(0)),
      // Batched lookup: one grouped query per page of vouchers.
      paidForExpenses: jest.fn().mockResolvedValue(new Map()),
      assertPeriodOpen: jest.fn().mockResolvedValue(undefined),
    };
    dues = { recordPayment: jest.fn().mockResolvedValue({ id: 77 }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        { provide: PrismaService, useValue: prisma },
        { provide: LedgerService, useValue: ledger },
        { provide: DuesService, useValue: dues },
      ],
    }).compile();
    service = module.get(ExpensesService);
  });

  const base = {
    expenseDate: '2026-08-12',
    categoryId: 1,
    partyId: 3,
    amount: '1000.00',
    amountIncludesVat: false,
    vatRate: '15',
    aitPercent: '0',
    vdsPercent: '0',
    paymentStatus: 'paid' as const,
    paidFromAccountId: 2,
  };

  describe('VAT split comes from the shared math', () => {
    it('adds VAT on top when the amount excludes it', async () => {
      await service.create(base, 7);
      const data = tx.expense.create.mock.calls[0][0].data;
      expect(new Prisma.Decimal(data.netAmount).toFixed(2)).toBe('1000.00');
      expect(new Prisma.Decimal(data.vatAmount).toFixed(2)).toBe('150.00');
      expect(new Prisma.Decimal(data.grossAmount).toFixed(2)).toBe('1150.00');
    });

    it('extracts VAT from within when the amount includes it (defect D4)', async () => {
      await service.create({ ...base, amount: '1150.00', amountIncludesVat: true }, 7);
      const data = tx.expense.create.mock.calls[0][0].data;
      expect(new Prisma.Decimal(data.netAmount).toFixed(2)).toBe('1000.00');
      expect(new Prisma.Decimal(data.vatAmount).toFixed(2)).toBe('150.00');
      expect(new Prisma.Decimal(data.grossAmount).toFixed(2)).toBe('1150.00');
    });

    it('reduces net payable by AIT and VDS', async () => {
      await service.create({ ...base, aitPercent: '5', vdsPercent: '100' }, 7);
      const data = tx.expense.create.mock.calls[0][0].data;
      expect(new Prisma.Decimal(data.netPayable).toFixed(2)).toBe('950.00');
    });

    it('rejects a non-numeric amount', async () => {
      await expect(service.create({ ...base, amount: 'abc' }, 7)).rejects.toThrow(BadRequestException);
    });
  });

  describe('payment status', () => {
    it('a fully paid expense posts one ledger entry and creates no payable', async () => {
      await service.create(base, 7);
      expect(ledger.post).toHaveBeenCalledTimes(1);
      expect(ledger.post.mock.calls[0][0].direction).toBe('OUT');
      expect(new Prisma.Decimal(ledger.post.mock.calls[0][0].amount).toFixed(2)).toBe('1150.00');
      expect(tx.due.create).not.toHaveBeenCalled();
    });

    it('an unpaid expense creates exactly one payable and posts nothing', async () => {
      await service.create(
        { ...base, paymentStatus: 'due', paidFromAccountId: undefined, dueDate: '2026-08-27' },
        7,
      );
      expect(ledger.post).not.toHaveBeenCalled();
      expect(tx.due.create).toHaveBeenCalledTimes(1);
      const due = tx.due.create.mock.calls[0][0].data;
      expect(due.kind).toBe('PAYABLE');
      expect(due.source).toBe('EXPENSE');
      expect(due.partyId).toBe(3);
      expect(due.expenseId).toBe(42);
      expect(new Prisma.Decimal(due.amount).toFixed(2)).toBe('1150.00');
    });

    it('a partial payment posts the paid part and books the remainder as a payable', async () => {
      await service.create(
        { ...base, paymentStatus: 'partial', paidNow: '400.00', dueDate: '2026-08-27' },
        7,
      );
      expect(new Prisma.Decimal(ledger.post.mock.calls[0][0].amount).toFixed(2)).toBe('400.00');
      const due = tx.due.create.mock.calls[0][0].data;
      expect(new Prisma.Decimal(due.amount).toFixed(2)).toBe('750.00'); // 1150 - 400
    });

    it('rejects a partial payment that is not smaller than the bill', async () => {
      await expect(service.create({ ...base, paymentStatus: 'partial', paidNow: '1150.00' }, 7))
        .rejects.toThrow(BadRequestException);
    });

    it('rejects a partial payment of zero', async () => {
      await expect(service.create({ ...base, paymentStatus: 'partial', paidNow: '0' }, 7))
        .rejects.toThrow(BadRequestException);
    });

    it('requires an account when money actually moves', async () => {
      await expect(service.create({ ...base, paidFromAccountId: undefined }, 7))
        .rejects.toThrow(BadRequestException);
    });

    it('refuses to save into a locked period', async () => {
      ledger.assertPeriodOpen.mockRejectedValue(new BadRequestException('locked'));
      await expect(service.create(base, 7)).rejects.toThrow(BadRequestException);
      expect(tx.expense.create).not.toHaveBeenCalled();
    });
  });

  describe('voucher numbers', () => {
    it('starts a month at 0001', async () => {
      tx.expense.findFirst.mockResolvedValue(null);
      await service.create(base, 7);
      expect(tx.expense.create.mock.calls[0][0].data.voucherNo).toBe('EXP-2608-0001');
    });

    it('continues from the highest existing number in that month', async () => {
      // Derived from the max, not a row count: a count collides the moment
      // someone backdates a voucher into a month that already has some.
      tx.expense.findFirst.mockResolvedValue({ voucherNo: 'EXP-2608-0005' });
      await service.create(base, 7);
      expect(tx.expense.create.mock.calls[0][0].data.voucherNo).toBe('EXP-2608-0006');
    });
  });

  describe('derived payment status', () => {
    it.each([
      ['0.00', 'UNPAID'],
      ['400.00', 'PARTIAL'],
      ['1150.00', 'PAID'],
    ])('with %s paid the status is %s', async (paid, expected) => {
      ledger.paidForExpense.mockResolvedValue(D(paid));
      const dto = await service.findOne(42);
      expect(dto.paymentStatus).toBe(expected);
      expect(dto.paidAmount).toBe(new Prisma.Decimal(paid).toFixed(2));
    });

    it('reports the remaining balance', async () => {
      ledger.paidForExpense.mockResolvedValue(D('400.00'));
      expect((await service.findOne(42)).remaining).toBe('750.00');
    });
  });

  describe('void — defect D6', () => {
    it('reverses the ledger entries instead of deleting the voucher', async () => {
      prisma.client.ledgerEntry.findMany.mockResolvedValue([{ id: 100 }, { id: 102 }]);

      await service.void(42, 7);

      expect(ledger.reverse).toHaveBeenCalledTimes(2);
      expect(ledger.reverse).toHaveBeenCalledWith(100, 7, expect.anything());
      expect(tx.expense.update.mock.calls[0][0].data.voidedAt).toBeInstanceOf(Date);
      expect((prisma.client.expense as Record<string, unknown>).delete).toBeUndefined();
    });

    it('refuses to void an already-voided expense', async () => {
      prisma.client.expense.findUnique.mockResolvedValue({ ...savedExpense, voidedAt: new Date() });
      await expect(service.void(42, 7)).rejects.toThrow(BadRequestException);
    });

    it('throws for an unknown expense', async () => {
      prisma.client.expense.findUnique.mockResolvedValue(null);
      await expect(service.void(99, 7)).rejects.toThrow(NotFoundException);
    });

    it('voids the linked payable too, so it stops showing as owed', async () => {
      await service.void(42, 7);
      expect(tx.due.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { expenseId: 42, voidedAt: null } }),
      );
    });

    it('also reverses instalments paid against the generated payable', async () => {
      // Payments made at save time carry expenseId, but instalments paid
      // later against the payable carry dueId. Missing the second set leaves
      // the voucher cancelled while the cash stays gone — caught by an
      // end-to-end run against the real database, not by the mocks.
      prisma.client.due.findMany = jest.fn().mockResolvedValue([{ id: 77 }]);
      prisma.client.ledgerEntry.findMany.mockResolvedValue([{ id: 100 }, { id: 200 }]);

      await service.void(42, 7);

      const where = prisma.client.ledgerEntry.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([{ expenseId: 42 }, { dueId: { in: [77] } }]);
      expect(ledger.reverse).toHaveBeenCalledTimes(2);
    });

    it('looks only at the expense when it generated no payable', async () => {
      prisma.client.due.findMany = jest.fn().mockResolvedValue([]);
      prisma.client.ledgerEntry.findMany.mockResolvedValue([{ id: 100 }]);
      await service.void(42, 7);
      const where = prisma.client.ledgerEntry.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([{ expenseId: 42 }]);
    });
  });

  describe('recordPayment', () => {
    it('pays through the linked payable, so there is one payment path', async () => {
      prisma.client.due.findFirst.mockResolvedValue({ id: 77 });
      await service.recordPayment(42, { amount: '100.00', paymentDate: '2026-08-20', accountId: 2 }, 7);
      expect(dues.recordPayment).toHaveBeenCalledWith(
        77, { amount: '100.00', paymentDate: '2026-08-20', accountId: 2 }, 7,
      );
    });

    it('refuses when the expense has no outstanding payable', async () => {
      prisma.client.due.findFirst.mockResolvedValue(null);
      await expect(
        service.recordPayment(42, { amount: '100.00', paymentDate: '2026-08-20', accountId: 2 }, 7),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('list', () => {
    it('excludes voided expenses by default', async () => {
      await service.list({ page: 1, pageSize: 20 });
      expect(prisma.client.expense.findMany.mock.calls[0][0].where.voidedAt).toBeNull();
    });

    it('narrows to matching ids when filtering on derived payment status', async () => {
      prisma.client.$queryRaw.mockResolvedValue([{ id: 42 }, { id: 43 }]);
      await service.list({ page: 1, pageSize: 20, paymentStatus: 'UNPAID' });
      expect(prisma.client.$queryRaw).toHaveBeenCalled();
      expect(prisma.client.expense.findMany.mock.calls[0][0].where.id).toEqual({ in: [42, 43] });
    });
  });
});
