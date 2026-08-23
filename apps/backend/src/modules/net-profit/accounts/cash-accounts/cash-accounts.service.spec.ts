import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { CashAccountsService } from './cash-accounts.service';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../../../../common/prisma/prisma.service';

const D = (v: string | number) => new Prisma.Decimal(v);

const bkash = {
  id: 1,
  name: 'bKash',
  type: 'MOBILE_WALLET' as const,
  accountNumber: null,
  openingBalance: D('1000.00'),
  openingDate: new Date('2026-08-01'),
  isActive: true,
  sortOrder: 0,
};

describe('CashAccountsService', () => {
  let service: CashAccountsService;
  let prisma: { client: Record<string, Record<string, jest.Mock>> & { $transaction: jest.Mock } };
  let ledger: { post: jest.Mock; accountBalance: jest.Mock; accountBalances: jest.Mock };

  beforeEach(async () => {
    const client = {
      cashAccount: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      ledgerEntry: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn({})),
    };
    prisma = { client } as never;
    ledger = {
      post: jest.fn().mockResolvedValue({ id: 1 }),
      accountBalance: jest.fn().mockResolvedValue(D(0)),
      // Batched: two queries for every account rather than two per account.
      accountBalances: jest.fn().mockResolvedValue(new Map()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CashAccountsService,
        { provide: PrismaService, useValue: prisma },
        { provide: LedgerService, useValue: ledger },
      ],
    }).compile();
    service = module.get(CashAccountsService);
  });

  it('reports a computed balance, not a stored one', async () => {
    prisma.client.cashAccount.findMany.mockResolvedValue([bkash]);
    ledger.accountBalances.mockResolvedValue(new Map([[1, D('4321.00')]]));
    const [dto] = await service.list();
    expect(dto.balance).toBe('4321.00');
    expect(dto.openingBalance).toBe('1000.00');
    // One batched call for the whole list, not one per account.
    expect(ledger.accountBalances).toHaveBeenCalledTimes(1);
    expect(ledger.accountBalance).not.toHaveBeenCalled();
  });

  it('rejects an opening balance that is not a number', async () => {
    await expect(service.create({
      name: 'Bad', type: 'CASH', openingBalance: 'abc', openingDate: '2026-08-01',
    })).rejects.toThrow(BadRequestException);
  });

  describe('transfer', () => {
    const dto = {
      fromAccountId: 1,
      toAccountId: 2,
      amount: '500.00',
      transferDate: '2026-08-12',
      reference: 'TRX1',
    };

    it('writes exactly two entries, one out and one in', async () => {
      await service.transfer(dto, 7);
      expect(ledger.post).toHaveBeenCalledTimes(2);
      const [first] = ledger.post.mock.calls[0];
      const [second] = ledger.post.mock.calls[1];
      expect(first.direction).toBe('OUT');
      expect(first.accountId).toBe(1);
      expect(second.direction).toBe('IN');
      expect(second.accountId).toBe(2);
      expect(first.source).toBe('TRANSFER');
      expect(second.source).toBe('TRANSFER');
    });

    it('books both legs for the same amount', async () => {
      await service.transfer(dto, 7);
      const amounts = ledger.post.mock.calls.map((c) => new Prisma.Decimal(c[0].amount).toFixed(2));
      expect(amounts).toEqual(['500.00', '500.00']);
    });

    it('writes both legs inside one transaction', async () => {
      // A half-written transfer would invent or destroy money.
      await service.transfer(dto, 7);
      expect(prisma.client.$transaction).toHaveBeenCalledTimes(1);
    });

    it('rejects a transfer to the same account', async () => {
      await expect(service.transfer({ ...dto, toAccountId: 1 }, 7))
        .rejects.toThrow(BadRequestException);
      expect(ledger.post).not.toHaveBeenCalled();
    });

    it('rejects a zero amount', async () => {
      await expect(service.transfer({ ...dto, amount: '0' }, 7)).rejects.toThrow(BadRequestException);
    });

    it('rejects a negative amount', async () => {
      await expect(service.transfer({ ...dto, amount: '-5' }, 7)).rejects.toThrow(BadRequestException);
    });
  });

  describe('ledger', () => {
    it('reports opening, entries and closing for the range', async () => {
      prisma.client.cashAccount.findUnique.mockResolvedValue(bkash);
      ledger.accountBalance
        .mockResolvedValueOnce(D('1000.00'))  // opening, the day before `from`
        .mockResolvedValueOnce(D('1300.00')); // closing, at `to`
      prisma.client.ledgerEntry.findMany.mockResolvedValue([
        { id: 1, entryDate: new Date('2026-08-12'), direction: 'IN', amount: D('500.00'), source: 'SALE', reference: null, note: null, partyId: null },
        { id: 2, entryDate: new Date('2026-08-13'), direction: 'OUT', amount: D('200.00'), source: 'EXPENSE_PAYMENT', reference: null, note: null, partyId: null },
      ]);

      const result = await service.ledger(1, '2026-08-01', '2026-08-31');

      expect(result.opening).toBe('1000.00');
      expect(result.closing).toBe('1300.00');
      expect(result.entries).toHaveLength(2);
    });

    it('throws for an unknown account', async () => {
      prisma.client.cashAccount.findUnique.mockResolvedValue(null);
      await expect(service.ledger(99)).rejects.toThrow(NotFoundException);
    });
  });
});
