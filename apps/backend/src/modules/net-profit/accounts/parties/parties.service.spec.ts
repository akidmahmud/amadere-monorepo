import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { PartiesService } from './parties.service';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../../../../common/prisma/prisma.service';

const D = (v: string | number) => new Prisma.Decimal(v);

const steadfast = {
  id: 1,
  name: 'Steadfast',
  type: 'COMPANY' as const,
  roles: ['COURIER', 'CUSTOMER', 'SUPPLIER'],
  phone: null,
  email: null,
  address: null,
  bin: null,
  tin: null,
  customerId: null,
  openingReceivable: D(0),
  openingPayable: D(0),
  creditLimit: null,
  creditDays: null,
  courierProvider: 'STEADFAST' as const,
  note: null,
  isActive: true,
  deletedAt: null,
};

describe('PartiesService', () => {
  let service: PartiesService;
  let prisma: { client: { party: Record<string, jest.Mock>; ledgerEntry: Record<string, jest.Mock>; due: Record<string, jest.Mock> } };
  let ledger: { partyPosition: jest.Mock; partyPositions: jest.Mock };

  beforeEach(async () => {
    prisma = {
      client: {
        party: {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
          create: jest.fn(),
          update: jest.fn(),
          findUnique: jest.fn(),
          findFirst: jest.fn().mockResolvedValue(null),
        },
        ledgerEntry: { findMany: jest.fn().mockResolvedValue([]) },
        due: { findMany: jest.fn().mockResolvedValue([]) },
      },
    };
    ledger = {
      partyPosition: jest.fn().mockResolvedValue({ receivable: D(0), payable: D(0), net: D(0) }),
      partyPositions: jest.fn().mockResolvedValue(new Map()),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartiesService,
        { provide: PrismaService, useValue: prisma },
        { provide: LedgerService, useValue: ledger },
      ],
    }).compile();
    service = module.get(PartiesService);
  });

  it('reports a net position for a party that is both debtor and creditor', async () => {
    // Steadfast holds our COD cash and invoices us for delivery — the whole
    // reason parties are one table rather than two free-text name fields.
    prisma.client.party.findUnique.mockResolvedValue(steadfast);
    ledger.partyPosition.mockResolvedValue({
      receivable: D('82000.00'), payable: D('11500.00'), net: D('70500.00'),
    });

    const dto = await service.findOne(1);

    expect(dto.receivable).toBe('82000.00');
    expect(dto.payable).toBe('11500.00');
    expect(dto.net).toBe('70500.00');
  });

  it('throws for an unknown party', async () => {
    prisma.client.party.findUnique.mockResolvedValue(null);
    await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
  });

  describe('create', () => {
    it('rejects a party with no roles', async () => {
      await expect(service.create({ name: 'Nobody', type: 'COMPANY', roles: [] }, 1))
        .rejects.toThrow(BadRequestException);
    });

    it('rejects a duplicate courierProvider mapping', async () => {
      prisma.client.party.findFirst.mockResolvedValue({ id: 9, name: 'Steadfast' });
      await expect(service.create(
        { name: 'Steadfast Duplicate', type: 'COMPANY', roles: ['COURIER'], courierProvider: 'STEADFAST' },
        1,
      )).rejects.toThrow(BadRequestException);
    });

    it('allows a party with no courierProvider without checking for a clash', async () => {
      prisma.client.party.create.mockResolvedValue(steadfast);
      await service.create({ name: 'Rahim Stores', type: 'COMPANY', roles: ['SUPPLIER'] }, 1);
      expect(prisma.client.party.findFirst).not.toHaveBeenCalled();
    });

    it('stores opening balances as Decimal', async () => {
      prisma.client.party.create.mockResolvedValue(steadfast);
      await service.create(
        { name: 'X', type: 'COMPANY', roles: ['SUPPLIER'], openingPayable: '1500.50' },
        1,
      );
      const data = prisma.client.party.create.mock.calls[0][0].data;
      expect(new Prisma.Decimal(data.openingPayable).toFixed(2)).toBe('1500.50');
    });
  });

  describe('softDelete', () => {
    it('soft-deletes rather than removing the row', async () => {
      prisma.client.party.findUnique.mockResolvedValue({ ...steadfast, id: 3 });
      prisma.client.party.update.mockResolvedValue({ ...steadfast, id: 3 });
      await service.softDelete(3);
      const args = prisma.client.party.update.mock.calls[0][0];
      expect(args.data.deletedAt).toBeInstanceOf(Date);
      expect(args.data.isActive).toBe(false);
      expect((prisma.client.party as Record<string, unknown>).delete).toBeUndefined();
    });

    it('throws for an unknown party', async () => {
      prisma.client.party.findUnique.mockResolvedValue(null);
      await expect(service.softDelete(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('list', () => {
    it('hides soft-deleted parties', async () => {
      await service.list({ page: 1, pageSize: 20 });
      expect(prisma.client.party.findMany.mock.calls[0][0].where.deletedAt).toBeNull();
    });

    it('filters by role', async () => {
      await service.list({ page: 1, pageSize: 20, role: 'COURIER' });
      expect(prisma.client.party.findMany.mock.calls[0][0].where.roles).toEqual({ has: 'COURIER' });
    });

    it('searches name and phone case-insensitively', async () => {
      await service.list({ page: 1, pageSize: 20, q: 'stead' });
      const where = prisma.client.party.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([
        { name: { contains: 'stead', mode: 'insensitive' } },
        { phone: { contains: 'stead', mode: 'insensitive' } },
      ]);
    });
  });

  describe('resolveCourierParty', () => {
    it('finds the party mapped to a provider', async () => {
      prisma.client.party.findFirst.mockResolvedValue({ id: 1, name: 'Steadfast' });
      expect(await service.resolveCourierParty('STEADFAST')).toEqual({ id: 1, name: 'Steadfast' });
    });

    it('fails loudly for an unmapped provider instead of guessing', async () => {
      // Nothing may hardcode Steadfast: silently falling back to it would
      // book another courier's payout against the wrong balance.
      prisma.client.party.findFirst.mockResolvedValue(null);
      await expect(service.resolveCourierParty('PATHAO')).rejects.toThrow(/PATHAO/);
    });
  });

  describe('statement', () => {
    it('returns the party, its ledger entries, its open dues and the position', async () => {
      prisma.client.party.findUnique.mockResolvedValue(steadfast);
      prisma.client.ledgerEntry.findMany.mockResolvedValue([
        { id: 1, entryDate: new Date('2026-08-12'), direction: 'IN', amount: D('100.00'), source: 'SALE', reference: null, note: null },
      ]);
      prisma.client.due.findMany.mockResolvedValue([
        { id: 5, docNo: 'AR-2608-0001', kind: 'RECEIVABLE', amount: D('500.00'), dueDate: null, issueDate: new Date('2026-08-01'), source: 'MANUAL' },
      ]);

      const statement = await service.statement(1);

      expect(statement.party.name).toBe('Steadfast');
      expect(statement.entries).toHaveLength(1);
      expect(statement.dues).toHaveLength(1);
      expect(statement.position.net).toBe('0.00');
    });

    it('excludes voided dues from the statement', async () => {
      prisma.client.party.findUnique.mockResolvedValue(steadfast);
      await service.statement(1);
      expect(prisma.client.due.findMany.mock.calls[0][0].where.voidedAt).toBeNull();
    });
  });
});
