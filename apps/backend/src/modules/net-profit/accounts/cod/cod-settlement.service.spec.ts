import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { CodSettlementService } from './cod-settlement.service';
import { LedgerService } from '../ledger/ledger.service';
import { ExpensesService } from '../expenses/expenses.service';
import { PartiesService } from '../parties/parties.service';
import { PrismaService } from '../../../../common/prisma/prisma.service';

const D = (v: string | number) => new Prisma.Decimal(v);

describe('CodSettlementService', () => {
  let service: CodSettlementService;
  let prisma: { client: Record<string, Record<string, jest.Mock>> & { $transaction: jest.Mock } };
  let ledger: { post: jest.Mock; assertPeriodOpen: jest.Mock };
  let expenses: { create: jest.Mock };
  let parties: { resolveCourierParty: jest.Mock };

  const tx = {
    codSettlement: { create: jest.fn(), update: jest.fn() },
    shipment: { updateMany: jest.fn() },
    due: {
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
  };

  // COD 2000.00 collected, 140.00 of courier charges, so 1860.00 expected.
  const shipments = [
    { id: 30, orderId: 12, provider: 'STEADFAST', cost: D('60.00'), codAmount: D('1200.00') },
    { id: 31, orderId: 13, provider: 'STEADFAST', cost: D('80.00'), codAmount: D('800.00') },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();
    tx.codSettlement.create.mockResolvedValue({ id: 3 });
    tx.due.findMany.mockResolvedValue([
      { id: 9, orderId: 12 },
      { id: 10, orderId: 13 },
    ]);

    const client = {
      shipment: { findMany: jest.fn().mockResolvedValue(shipments) },
      expenseCategory: {
        findFirst: jest.fn().mockResolvedValue({ id: 5, name: 'Courier & Logistics' }),
      },
      codSettlement: { update: jest.fn() },
      $transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
    };
    prisma = { client } as never;

    ledger = {
      post: jest.fn().mockResolvedValue({ id: 1 }),
      assertPeriodOpen: jest.fn().mockResolvedValue(undefined),
    };
    expenses = { create: jest.fn().mockResolvedValue({ id: 55 }) };
    parties = { resolveCourierParty: jest.fn().mockResolvedValue({ id: 4, name: 'Steadfast' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CodSettlementService,
        { provide: PrismaService, useValue: prisma },
        { provide: LedgerService, useValue: ledger },
        { provide: ExpensesService, useValue: expenses },
        { provide: PartiesService, useValue: parties },
      ],
    }).compile();
    service = module.get(CodSettlementService);
  });

  const dto = {
    provider: 'STEADFAST' as const,
    settlementDate: '2026-08-15',
    netPayout: '1860.00',
    accountId: 2,
    reference: 'BANK-778',
  };

  it('nets to the payout that reached the bank, not to the order totals (defect D3)', async () => {
    // Three legs: receivables clear at face value (+2000), the courier's
    // charges post as an expense (-140), and any discrepancy gets its own
    // entry. They must sum to what actually landed.
    await service.settle(dto, 7);

    const remittanceIn = ledger.post.mock.calls
      .map((c) => c[0])
      .filter((p) => p.source === 'COD_REMITTANCE')
      .reduce((acc, p) => acc.plus(p.amount), D(0));
    expect(remittanceIn.toFixed(2)).toBe('2000.00');

    const charges = new Prisma.Decimal(expenses.create.mock.calls[0][0].amount);
    expect(remittanceIn.minus(charges).toFixed(2)).toBe('1860.00');
    expect(ledger.post.mock.calls[0][0].accountId).toBe(2);
  });

  it('posts an adjustment leg so the account balance matches the bank line', async () => {
    // Without this the ledger would net to the *expected* 1860 while only
    // 1850 arrived, and the cash balance would silently drift.
    await service.settle({ ...dto, netPayout: '1850.00' }, 7);
    const adj = ledger.post.mock.calls.map((c) => c[0]).find((p) => p.source === 'ADJUSTMENT');
    expect(adj).toBeDefined();
    expect(adj.direction).toBe('OUT');
    expect(new Prisma.Decimal(adj.amount).toFixed(2)).toBe('10.00');
  });

  it('posts no adjustment leg when the payout matches exactly', async () => {
    await service.settle(dto, 7);
    expect(ledger.post.mock.calls.map((c) => c[0]).some((p) => p.source === 'ADJUSTMENT')).toBe(false);
  });

  it('books the courier charges as one voucher equal to the sum of shipment costs', async () => {
    await service.settle(dto, 7);
    expect(expenses.create).toHaveBeenCalledTimes(1);
    const voucher = expenses.create.mock.calls[0][0];
    expect(voucher.amount).toBe('140.00');
    expect(voucher.partyId).toBe(4);
    expect(voucher.categoryId).toBe(5);
  });

  it('records a shortfall as an adjustment instead of absorbing it', async () => {
    const result = await service.settle({ ...dto, netPayout: '1850.00' }, 7);
    expect(result.adjustment).toBe('-10.00');
    expect(
      new Prisma.Decimal(tx.codSettlement.create.mock.calls[0][0].data.adjustment).toFixed(2),
    ).toBe('-10.00');
  });

  it('records an overpayment as a positive adjustment', async () => {
    const result = await service.settle({ ...dto, netPayout: '1900.00' }, 7);
    expect(result.adjustment).toBe('40.00');
  });

  it('reports a zero adjustment when the payout matches', async () => {
    const result = await service.settle(dto, 7);
    expect(result.adjustment).toBe('0.00');
  });

  it('stamps every shipment in the batch so it can never be settled twice', async () => {
    await service.settle(dto, 7);
    expect(tx.shipment.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [30, 31] } },
      data: { codSettlementId: 3 },
    });
  });

  it('excludes shipments that already carry a settlement id', async () => {
    await service.settle(dto, 7);
    expect(prisma.client.shipment.findMany.mock.calls[0][0].where.codSettlementId).toBeNull();
  });

  it('clears the COD_IN_TRANSIT receivable for each order in the batch', async () => {
    await service.settle(dto, 7);
    const dueIds = ledger.post.mock.calls.map((c) => c[0].dueId).filter(Boolean);
    expect(dueIds).toEqual(expect.arrayContaining([9, 10]));
  });

  it('refuses to settle an empty batch', async () => {
    prisma.client.shipment.findMany.mockResolvedValue([]);
    await expect(service.settle(dto, 7)).rejects.toThrow(BadRequestException);
  });

  it('fails loudly when the provider has no mapped party', async () => {
    parties.resolveCourierParty.mockRejectedValue(
      new BadRequestException('No party is mapped to courier PATHAO'),
    );
    await expect(service.settle({ ...dto, provider: 'PATHAO' }, 7)).rejects.toThrow(/PATHAO/);
  });

  it('fails with a clear message when the courier expense category is missing', async () => {
    prisma.client.expenseCategory.findFirst.mockResolvedValue(null);
    await expect(service.settle(dto, 7)).rejects.toThrow(/Courier & Logistics/);
  });

  it('refuses to settle into a locked accounting period', async () => {
    ledger.assertPeriodOpen.mockRejectedValue(new BadRequestException('period locked'));
    await expect(service.settle(dto, 7)).rejects.toThrow(BadRequestException);
    expect(tx.codSettlement.create).not.toHaveBeenCalled();
  });

  describe('pending', () => {
    it('groups unsettled delivered COD shipments into a batch per provider', async () => {
      const batches = await service.pending();
      expect(batches).toHaveLength(1);
      expect(batches[0].provider).toBe('STEADFAST');
      expect(batches[0].shipmentCount).toBe(2);
      expect(batches[0].codCollected).toBe('2000.00');
      expect(batches[0].courierCharges).toBe('140.00');
      expect(batches[0].expected).toBe('1860.00');
    });

    it('returns nothing when there is no unsettled COD', async () => {
      prisma.client.shipment.findMany.mockResolvedValue([]);
      expect(await service.pending()).toEqual([]);
    });
  });
});
