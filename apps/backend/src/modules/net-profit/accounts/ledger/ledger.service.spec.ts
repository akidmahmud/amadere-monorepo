import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { LedgerService } from './ledger.service';
import { PrismaService } from '../../../../common/prisma/prisma.service';

const D = (v: string | number) => new Prisma.Decimal(v);

function createMockPrismaService() {
  return {
    client: {
      ledgerEntry: {
        create: jest.fn(),
        findUnique: jest.fn(),
        aggregate: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      cashAccount: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      periodLock: { findFirst: jest.fn().mockResolvedValue(null) },
      due: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    },
  };
}

describe('LedgerService', () => {
  let service: LedgerService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [LedgerService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(LedgerService);
  });

  const base = {
    entryDate: new Date('2026-08-12T00:00:00Z'),
    direction: 'OUT' as const,
    amount: D('500.00'),
    accountId: 1,
    source: 'EXPENSE_PAYMENT' as const,
  };

  describe('post', () => {
    it('writes one entry with the amount stored positive', async () => {
      prisma.client.ledgerEntry.create.mockResolvedValue({ id: 10 });
      await service.post(base, 7);
      const data = prisma.client.ledgerEntry.create.mock.calls[0][0].data;
      expect(data.direction).toBe('OUT');
      expect(new Prisma.Decimal(data.amount).toFixed(2)).toBe('500.00');
      expect(data.createdBy).toBe(7);
    });

    it('rejects a zero amount', async () => {
      await expect(service.post({ ...base, amount: D(0) }, 7))
        .rejects.toThrow(BadRequestException);
    });

    it('rejects a negative amount — direction carries the sign, not the value', async () => {
      await expect(service.post({ ...base, amount: D('-1.00') }, 7))
        .rejects.toThrow(BadRequestException);
    });

    it('refuses to post into a locked period', async () => {
      prisma.client.periodLock.findFirst.mockResolvedValue({ id: 1, month: new Date('2026-08-01') });
      await expect(service.post(base, 7)).rejects.toThrow(BadRequestException);
      expect(prisma.client.ledgerEntry.create).not.toHaveBeenCalled();
    });

    it('matches a period lock on the first of the entry month', async () => {
      prisma.client.ledgerEntry.create.mockResolvedValue({ id: 10 });
      await service.post(base, 7);
      const where = prisma.client.periodLock.findFirst.mock.calls[0][0].where;
      expect((where.month as Date).toISOString().slice(0, 10)).toBe('2026-08-01');
    });
  });

  describe('reverse', () => {
    const original = {
      id: 10,
      entryDate: base.entryDate,
      direction: 'OUT' as const,
      amount: D('500.00'),
      accountId: 1,
      partyId: 3,
      source: 'EXPENSE_PAYMENT' as const,
      expenseId: 9,
      dueId: null,
      orderId: null,
      reversalOfId: null,
    };

    it('writes an opposite entry pointing back at the original', async () => {
      prisma.client.ledgerEntry.findUnique.mockResolvedValue(original);
      prisma.client.ledgerEntry.create.mockResolvedValue({ id: 11 });

      await service.reverse(10, 7);

      const data = prisma.client.ledgerEntry.create.mock.calls[0][0].data;
      expect(data.direction).toBe('IN');
      expect(new Prisma.Decimal(data.amount).toFixed(2)).toBe('500.00');
      expect(data.reversalOfId).toBe(10);
      expect(data.expenseId).toBe(9);
    });

    it('never deletes the original', async () => {
      prisma.client.ledgerEntry.findUnique.mockResolvedValue(original);
      prisma.client.ledgerEntry.create.mockResolvedValue({ id: 11 });
      await service.reverse(10, 7);
      expect((prisma.client.ledgerEntry as Record<string, unknown>).delete).toBeUndefined();
    });

    it('refuses to reverse an entry that is already a reversal', async () => {
      prisma.client.ledgerEntry.findUnique.mockResolvedValue({ ...original, id: 11, reversalOfId: 10 });
      await expect(service.reverse(11, 7)).rejects.toThrow(BadRequestException);
    });

    it('throws when the entry does not exist', async () => {
      prisma.client.ledgerEntry.findUnique.mockResolvedValue(null);
      await expect(service.reverse(999, 7)).rejects.toThrow(NotFoundException);
    });
  });

  describe('accountBalance', () => {
    it('is opening plus money in minus money out', async () => {
      prisma.client.cashAccount.findUnique.mockResolvedValue({ id: 1, openingBalance: D('1000.00') });
      prisma.client.ledgerEntry.aggregate
        .mockResolvedValueOnce({ _sum: { amount: D('750.00') } })
        .mockResolvedValueOnce({ _sum: { amount: D('200.00') } });
      const balance = await service.accountBalance(1);
      expect(balance.toFixed(2)).toBe('1550.00');
    });

    it('treats an account with no entries as its opening balance', async () => {
      prisma.client.cashAccount.findUnique.mockResolvedValue({ id: 1, openingBalance: D('300.00') });
      prisma.client.ledgerEntry.aggregate
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce({ _sum: { amount: null } });
      expect((await service.accountBalance(1)).toFixed(2)).toBe('300.00');
    });

    it('throws for an unknown account', async () => {
      prisma.client.cashAccount.findUnique.mockResolvedValue(null);
      await expect(service.accountBalance(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('paidForDues — defect D1', () => {
    beforeEach(() => {
      prisma.client.due.findUnique.mockResolvedValue({ kind: 'RECEIVABLE' });
    });

    it('reads settled totals in a single grouped query, not one per due', async () => {
      // The N+1 this replaced issued two queries per row; a 200-row page of
      // parties ran into the thousands.
      prisma.client.ledgerEntry.groupBy.mockResolvedValue([
        { dueId: 5, direction: 'IN', _sum: { amount: D('450.00') } },
        { dueId: 6, direction: 'OUT', _sum: { amount: D('120.00') } },
      ]);

      const paid = await service.paidForDues([
        { id: 5, kind: 'RECEIVABLE' },
        { id: 6, kind: 'PAYABLE' },
      ]);

      expect(prisma.client.ledgerEntry.groupBy).toHaveBeenCalledTimes(1);
      expect(paid.get(5)!.toFixed(2)).toBe('450.00');
      expect(paid.get(6)!.toFixed(2)).toBe('120.00');
    });

    it('nets reversals back out', async () => {
      prisma.client.ledgerEntry.groupBy.mockResolvedValue([
        { dueId: 5, direction: 'IN', _sum: { amount: D('350.00') } },
        { dueId: 5, direction: 'OUT', _sum: { amount: D('100.00') } },
      ]);
      const paid = await service.paidForDues([{ id: 5, kind: 'RECEIVABLE' }]);
      expect(paid.get(5)!.toFixed(2)).toBe('250.00');
    });

    it('treats OUT as settling on a payable and IN as its reversal', async () => {
      prisma.client.ledgerEntry.groupBy.mockResolvedValue([
        { dueId: 5, direction: 'OUT', _sum: { amount: D('400.00') } },
        { dueId: 5, direction: 'IN', _sum: { amount: D('50.00') } },
      ]);
      const paid = await service.paidForDues([{ id: 5, kind: 'PAYABLE' }]);
      expect(paid.get(5)!.toFixed(2)).toBe('350.00');
    });

    it('reports zero for a due with no payments', async () => {
      prisma.client.ledgerEntry.groupBy.mockResolvedValue([]);
      const paid = await service.paidForDues([{ id: 5, kind: 'RECEIVABLE' }]);
      expect(paid.get(5)!.toFixed(2)).toBe('0.00');
    });

    it('issues no query at all for an empty page', async () => {
      const paid = await service.paidForDues([]);
      expect(prisma.client.ledgerEntry.groupBy).not.toHaveBeenCalled();
      expect(paid.size).toBe(0);
    });

    it('still answers for a single due', async () => {
      prisma.client.ledgerEntry.groupBy.mockResolvedValue([
        { dueId: 5, direction: 'IN', _sum: { amount: D('450.00') } },
      ]);
      expect((await service.paidForDue(5)).toFixed(2)).toBe('450.00');
    });
  });

  describe('paidForExpenses', () => {
    it('nets OUT against reversing IN per voucher in one query', async () => {
      prisma.client.ledgerEntry.groupBy.mockResolvedValue([
        { expenseId: 9, direction: 'OUT', _sum: { amount: D('500.00') } },
        { expenseId: 9, direction: 'IN', _sum: { amount: D('500.00') } },
        { expenseId: 10, direction: 'OUT', _sum: { amount: D('75.00') } },
      ]);
      const paid = await service.paidForExpenses([9, 10]);
      expect(prisma.client.ledgerEntry.groupBy).toHaveBeenCalledTimes(1);
      expect(paid.get(9)!.toFixed(2)).toBe('0.00');   // fully reversed
      expect(paid.get(10)!.toFixed(2)).toBe('75.00');
    });
  });

  describe('accountBalances', () => {
    it('computes every account from openings plus one grouped sum', async () => {
      prisma.client.cashAccount.findMany.mockResolvedValue([
        { id: 1, openingBalance: D('1000.00') },
        { id: 2, openingBalance: D('0.00') },
      ]);
      prisma.client.ledgerEntry.groupBy.mockResolvedValue([
        { accountId: 1, direction: 'IN', _sum: { amount: D('750.00') } },
        { accountId: 1, direction: 'OUT', _sum: { amount: D('200.00') } },
      ]);

      const balances = await service.accountBalances();

      expect(prisma.client.ledgerEntry.groupBy).toHaveBeenCalledTimes(1);
      expect(balances.get(1)!.toFixed(2)).toBe('1550.00');
      expect(balances.get(2)!.toFixed(2)).toBe('0.00');
    });
  });

  describe('partyPositions', () => {
    it('nets what a party owes us against what we owe them', async () => {
      // The Steadfast case: they hold our COD cash and they invoice us for
      // delivery. One party, one net figure.
      prisma.client.due.findMany.mockResolvedValue([
        { id: 1, kind: 'RECEIVABLE', amount: D('82000.00'), partyId: 4 },
        { id: 2, kind: 'PAYABLE', amount: D('11500.00'), partyId: 4 },
      ]);
      prisma.client.ledgerEntry.groupBy.mockResolvedValue([]);

      const position = await service.partyPosition(4);

      expect(position.receivable.toFixed(2)).toBe('82000.00');
      expect(position.payable.toFixed(2)).toBe('11500.00');
      expect(position.net.toFixed(2)).toBe('70500.00');
    });

    it(`keeps each party's dues to its own position`, async () => {
      prisma.client.due.findMany.mockResolvedValue([
        { id: 1, kind: 'RECEIVABLE', amount: D('100.00'), partyId: 4 },
        { id: 2, kind: 'RECEIVABLE', amount: D('900.00'), partyId: 7 },
      ]);
      prisma.client.ledgerEntry.groupBy.mockResolvedValue([]);

      const positions = await service.partyPositions([4, 7]);

      expect(positions.get(4)!.receivable.toFixed(2)).toBe('100.00');
      expect(positions.get(7)!.receivable.toFixed(2)).toBe('900.00');
    });

    it('reads every party in two queries regardless of how many there are', async () => {
      prisma.client.due.findMany.mockResolvedValue([]);
      await service.partyPositions([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(prisma.client.due.findMany).toHaveBeenCalledTimes(1);
      // No dues, so the grouped sum is skipped entirely.
      expect(prisma.client.ledgerEntry.groupBy).not.toHaveBeenCalled();
    });

    it('excludes fully settled dues', async () => {
      prisma.client.due.findMany.mockResolvedValue([
        { id: 1, kind: 'RECEIVABLE', amount: D('100.00'), partyId: 4 },
      ]);
      prisma.client.ledgerEntry.groupBy.mockResolvedValue([
        { dueId: 1, direction: 'IN', _sum: { amount: D('100.00') } },
      ]);
      const position = await service.partyPosition(4);
      expect(position.receivable.toFixed(2)).toBe('0.00');
    });

    it('ignores voided dues', async () => {
      prisma.client.due.findMany.mockResolvedValue([]);
      await service.partyPosition(4);
      expect(prisma.client.due.findMany.mock.calls[0][0].where.voidedAt).toBeNull();
    });
  });
});
