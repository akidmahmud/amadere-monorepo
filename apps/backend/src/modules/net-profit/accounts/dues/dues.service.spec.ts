import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { DuesService } from './dues.service';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../../../../common/prisma/prisma.service';

const D = (v: string | number) => new Prisma.Decimal(v);

describe('DuesService', () => {
  let service: DuesService;
  let prisma: { client: Record<string, Record<string, jest.Mock>> & { $transaction: jest.Mock; $queryRaw: jest.Mock } };
  let ledger: {
    post: jest.Mock; reverse: jest.Mock; paidForDue: jest.Mock; paidForDues: jest.Mock;
    assertPeriodOpen: jest.Mock;
  };

  const tx = {
    due: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
    },
  };

  const openDue = {
    id: 5,
    docNo: 'AR-2608-0001',
    kind: 'RECEIVABLE' as const,
    partyId: 3,
    source: 'MANUAL' as const,
    amount: D('1000.00'),
    issueDate: new Date('2026-08-01'),
    dueDate: new Date('2026-08-25'),
    expenseId: null,
    orderId: null,
    note: null,
    voidedAt: null,
    party: { id: 3, name: 'Rahim Stores' },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    tx.due.create.mockResolvedValue(openDue);
    tx.due.update.mockResolvedValue({ ...openDue, voidedAt: new Date() });
    tx.due.findFirst.mockResolvedValue(null);
    tx.due.findUnique.mockResolvedValue(openDue);

    const client = {
      due: {
        findUnique: jest.fn().mockResolvedValue(openDue),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      party: { findUnique: jest.fn().mockResolvedValue({ id: 3, name: 'Rahim Stores' }) },
      ledgerEntry: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    prisma = { client } as never;

    ledger = {
      post: jest.fn().mockResolvedValue({ id: 1 }),
      reverse: jest.fn().mockResolvedValue({ id: 2 }),
      paidForDue: jest.fn().mockResolvedValue(D(0)),
      // Batched lookup: one grouped query for a whole page or ageing scan.
      paidForDues: jest.fn().mockResolvedValue(new Map()),
      assertPeriodOpen: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DuesService,
        { provide: PrismaService, useValue: prisma },
        { provide: LedgerService, useValue: ledger },
      ],
    }).compile();
    service = module.get(DuesService);
  });

  describe('recordPayment — defect D1', () => {
    it('posts one ledger entry per instalment, never a running total', async () => {
      ledger.paidForDue.mockResolvedValue(D('300.00')); // already received
      await service.recordPayment(5, { amount: '200.00', paymentDate: '2026-08-12', accountId: 2 }, 7);

      expect(ledger.post).toHaveBeenCalledTimes(1);
      const posted = ledger.post.mock.calls[0][0];
      expect(new Prisma.Decimal(posted.amount).toFixed(2)).toBe('200.00'); // the instalment
      expect(posted.direction).toBe('IN');
      expect(posted.dueId).toBe(5);
      expect(posted.source).toBe('RECEIVABLE_RECEIPT');
    });

    it('pays a payable out, not in', async () => {
      prisma.client.due.findUnique.mockResolvedValue({ ...openDue, kind: 'PAYABLE' });
      await service.recordPayment(5, { amount: '200.00', paymentDate: '2026-08-12', accountId: 2 }, 7);
      expect(ledger.post.mock.calls[0][0].direction).toBe('OUT');
      expect(ledger.post.mock.calls[0][0].source).toBe('PAYABLE_PAYMENT');
    });

    it('refuses to overpay', async () => {
      ledger.paidForDue.mockResolvedValue(D('900.00'));
      await expect(
        service.recordPayment(5, { amount: '200.00', paymentDate: '2026-08-12', accountId: 2 }, 7),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows a payment that exactly clears the balance', async () => {
      ledger.paidForDue.mockResolvedValue(D('900.00'));
      await service.recordPayment(5, { amount: '100.00', paymentDate: '2026-08-12', accountId: 2 }, 7);
      expect(ledger.post).toHaveBeenCalledTimes(1);
    });

    it('refuses a zero or negative payment', async () => {
      await expect(
        service.recordPayment(5, { amount: '0', paymentDate: '2026-08-12', accountId: 2 }, 7),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses to pay a voided due', async () => {
      prisma.client.due.findUnique.mockResolvedValue({ ...openDue, voidedAt: new Date() });
      await expect(
        service.recordPayment(5, { amount: '10.00', paymentDate: '2026-08-12', accountId: 2 }, 7),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws for an unknown due', async () => {
      prisma.client.due.findUnique.mockResolvedValue(null);
      await expect(
        service.recordPayment(99, { amount: '10.00', paymentDate: '2026-08-12', accountId: 2 }, 7),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('derived status', () => {
    it.each([
      ['0.00', 'PENDING'],
      ['400.00', 'PARTIALLY_PAID'],
      ['1000.00', 'PAID'],
    ])('with %s received the status is %s', async (paid, expected) => {
      ledger.paidForDue.mockResolvedValue(D(paid));
      const dto = await service.findOne(5, new Date('2026-08-20T00:00:00Z'));
      expect(dto.status).toBe(expected);
      expect(dto.paidAmount).toBe(new Prisma.Decimal(paid).toFixed(2));
    });

    it('reports the ageing bucket and days for an overdue receivable', async () => {
      const dto = await service.findOne(5, new Date('2026-08-30T00:00:00Z'));
      expect(dto.bucket).toBe('1_30');
      expect(dto.ageDays).toBe(5);
    });

    it('reports CURRENT for a due date in the future', async () => {
      const dto = await service.findOne(5, new Date('2026-08-20T00:00:00Z'));
      expect(dto.bucket).toBe('CURRENT');
      expect(dto.ageDays).toBe(0);
    });
  });

  describe('create', () => {
    it('numbers a receivable AR- and a payable AP-', async () => {
      await service.create(
        { kind: 'RECEIVABLE', partyId: 3, amount: '500.00', issueDate: '2026-08-12' },
        7,
      );
      expect(tx.due.create.mock.calls[0][0].data.docNo).toBe('AR-2608-0001');

      jest.clearAllMocks();
      tx.due.create.mockResolvedValue(openDue);
      tx.due.findFirst.mockResolvedValue(null);
      await service.create(
        { kind: 'PAYABLE', partyId: 3, amount: '500.00', issueDate: '2026-08-12' },
        7,
      );
      expect(tx.due.create.mock.calls[0][0].data.docNo).toBe('AP-2608-0001');
    });

    it('defaults source to MANUAL', async () => {
      await service.create(
        { kind: 'RECEIVABLE', partyId: 3, amount: '500.00', issueDate: '2026-08-12' },
        7,
      );
      expect(tx.due.create.mock.calls[0][0].data.source).toBe('MANUAL');
    });

    it('rejects a non-positive amount', async () => {
      await expect(service.create(
        { kind: 'RECEIVABLE', partyId: 3, amount: '0', issueDate: '2026-08-12' },
        7,
      )).rejects.toThrow(BadRequestException);
    });
  });

  describe('void', () => {
    it('reverses ledger entries and stamps voidedAt rather than deleting', async () => {
      prisma.client.ledgerEntry.findMany.mockResolvedValue([{ id: 10 }]);
      await service.void(5, 7);
      expect(ledger.reverse).toHaveBeenCalledWith(10, 7, expect.anything());
      expect(tx.due.update.mock.calls[0][0].data.voidedAt).toBeInstanceOf(Date);
      expect((prisma.client.due as Record<string, unknown>).delete).toBeUndefined();
    });

    it('refuses to void twice', async () => {
      prisma.client.due.findUnique.mockResolvedValue({ ...openDue, voidedAt: new Date() });
      await expect(service.void(5, 7)).rejects.toThrow(BadRequestException);
    });
  });

  describe('ageing', () => {
    const asOf = new Date('2026-08-23T00:00:00Z');

    it('splits outstanding amounts into the four buckets', async () => {
      prisma.client.due.findMany.mockResolvedValue([
        { id: 1, kind: 'RECEIVABLE', amount: D('100.00'), dueDate: new Date('2026-09-01'), voidedAt: null },
        { id: 2, kind: 'RECEIVABLE', amount: D('200.00'), dueDate: new Date('2026-08-22'), voidedAt: null },
        { id: 3, kind: 'RECEIVABLE', amount: D('300.00'), dueDate: new Date('2026-07-01'), voidedAt: null },
        { id: 4, kind: 'RECEIVABLE', amount: D('400.00'), dueDate: new Date('2026-05-01'), voidedAt: null },
      ]);
      ledger.paidForDues.mockResolvedValue(new Map());

      const report = await service.ageing('RECEIVABLE', asOf);

      expect(report.buckets.CURRENT.amount).toBe('100.00');
      expect(report.buckets['1_30'].amount).toBe('200.00');
      expect(report.buckets['31_60'].amount).toBe('300.00');
      expect(report.buckets['60_PLUS'].amount).toBe('400.00');
      expect(report.total).toBe('1000.00');
      expect(report.overdue).toBe('900.00'); // everything but CURRENT
    });

    it('excludes fully settled dues', async () => {
      prisma.client.due.findMany.mockResolvedValue([
        { id: 1, kind: 'RECEIVABLE', amount: D('100.00'), dueDate: new Date('2026-08-01'), voidedAt: null },
      ]);
      ledger.paidForDues.mockResolvedValue(new Map([[1, D('100.00')]]));
      const report = await service.ageing('RECEIVABLE', asOf);
      expect(report.total).toBe('0.00');
    });

    it('counts only the unpaid remainder of a partially paid due', async () => {
      prisma.client.due.findMany.mockResolvedValue([
        { id: 1, kind: 'RECEIVABLE', amount: D('1000.00'), dueDate: new Date('2026-08-01'), voidedAt: null },
      ]);
      ledger.paidForDues.mockResolvedValue(new Map([[1, D('600.00')]]));
      const report = await service.ageing('RECEIVABLE', asOf);
      expect(report.total).toBe('400.00');
    });

    it('weights average age by amount', async () => {
      prisma.client.due.findMany.mockResolvedValue([
        { id: 1, kind: 'RECEIVABLE', amount: D('100.00'), dueDate: new Date('2026-08-13'), voidedAt: null }, // 10 days
        { id: 2, kind: 'RECEIVABLE', amount: D('900.00'), dueDate: new Date('2026-08-03'), voidedAt: null }, // 20 days
      ]);
      ledger.paidForDues.mockResolvedValue(new Map());
      const report = await service.ageing('RECEIVABLE', asOf);
      // (100*10 + 900*20) / 1000 = 19
      expect(report.averageAgeDays).toBe(19);
    });

    it('ignores voided dues', async () => {
      await service.ageing('RECEIVABLE', asOf);
      expect(prisma.client.due.findMany.mock.calls[0][0].where.voidedAt).toBeNull();
    });
  });

  describe('list', () => {
    it('narrows to matching ids when filtering on derived status', async () => {
      prisma.client.$queryRaw.mockResolvedValue([{ id: 5 }]);
      await service.list({ page: 1, pageSize: 20, status: 'PENDING' });
      expect(prisma.client.$queryRaw).toHaveBeenCalled();
      expect(prisma.client.due.findMany.mock.calls[0][0].where.id).toEqual({ in: [5] });
    });

    it('filters by kind', async () => {
      await service.list({ page: 1, pageSize: 20, kind: 'PAYABLE' });
      expect(prisma.client.due.findMany.mock.calls[0][0].where.kind).toBe('PAYABLE');
    });
  });
});
