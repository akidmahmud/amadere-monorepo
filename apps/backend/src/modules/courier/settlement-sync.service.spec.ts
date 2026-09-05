import { Test } from '@nestjs/testing';
import { Prisma } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ShipmentsService } from './shipments.service';
import { SettlementSyncService } from './settlement-sync.service';

const Decimal = Prisma.Decimal;

// Trimmed from a real Steadfast payout (SFC-31770483, 2026-09-05). Field
// names and nesting are theirs, verified live — the whole point of this test
// is that we keep parsing THAT shape, not a shape we invented.
const PAYOUT = {
  payment_id: 'SFC-31770483',
  amount: 50250,
  due_bills: 8025,
  charges: 423,
  total: 41802,
  status_label: 'processing',
  created_at: '2026-09-05 10:11:29',
  paid_at: null,
};

const CONSIGNMENTS = [
  // Matches a shipment, and Steadfast collected LESS than we asked. This is
  // the case the whole feature exists for.
  { consignment_id: 290888564, cod_amount: 2350, status: 'delivered' },
  // Matches, and agrees.
  { consignment_id: 290940764, cod_amount: 1430, status: 'delivered' },
  // Shipped outside this system on the same courier account.
  { consignment_id: 999999999, cod_amount: 500, status: 'delivered' },
];

describe('SettlementSyncService', () => {
  let service: SettlementSyncService;
  let updates: { where: unknown; data: Record<string, unknown> }[];

  const shipmentsByCid: Record<string, { id: number; orderId: number; codAmount: Prisma.Decimal | null; settledCodAmount: Prisma.Decimal | null }> = {
    '290888564': { id: 1, orderId: 101, codAmount: new Decimal(2450), settledCodAmount: null },
    '290940764': { id: 2, orderId: 102, codAmount: new Decimal(1430), settledCodAmount: null },
  };

  beforeEach(async () => {
    updates = [];

    const prisma = {
      client: {
        shipment: {
          findFirst: jest.fn(({ where }: { where: { consignmentId: string } }) =>
            Promise.resolve(shipmentsByCid[where.consignmentId] ?? null),
          ),
          update: jest.fn((args: { where: unknown; data: Record<string, unknown> }) => {
            updates.push(args);
            return Promise.resolve({});
          }),
        },
      },
    };

    // Page 1 has the payout, page 2+ is empty — so findLastPage settles on 1.
    const shipments = {
      getPayments: jest.fn((_p: string, q?: { page?: number; id?: string }) => {
        if (q?.id) return Promise.resolve({ raw: { payment: { ...PAYOUT, consignments: CONSIGNMENTS } } });
        return Promise.resolve({ raw: { payments: q?.page === 1 ? [PAYOUT] : [] } });
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SettlementSyncService,
        { provide: PrismaService, useValue: prisma },
        { provide: ShipmentsService, useValue: shipments },
      ],
    }).compile();

    service = moduleRef.get(SettlementSyncService);
  });

  it('writes what the courier actually collected onto the matching shipment', async () => {
    const result = await service.sync('STEADFAST');

    expect(result.parcelsSeen).toBe(3);
    expect(result.parcelsMatched).toBe(2);
    expect(result.shipmentsUpdated).toBe(2);
    // The third parcel is real, just not ours — it must not be treated as an
    // error, and it is why a payout's total charge cannot be split across
    // our orders.
    expect(result.parcelsUnknown).toBe(1);

    expect(updates).toHaveLength(2);
    expect(updates[0].data).toMatchObject({
      settlementReference: 'SFC-31770483',
      settlementStatus: 'delivered',
    });
    expect((updates[0].data.settledCodAmount as Prisma.Decimal).toString()).toBe('2350');
  });

  it('reports under-collection instead of silently absorbing it', async () => {
    const result = await service.sync('STEADFAST');

    expect(result.discrepancies).toEqual([
      { consignmentId: '290888564', orderId: 101, asked: '2450', collected: '2350' },
    ]);
  });

  it('does not rewrite a shipment whose settled amount is already correct', async () => {
    shipmentsByCid['290888564'].settledCodAmount = new Decimal(2350);
    shipmentsByCid['290940764'].settledCodAmount = new Decimal(1430);

    const result = await service.sync('STEADFAST');

    expect(result.parcelsMatched).toBe(2);
    expect(result.shipmentsUpdated).toBe(0);
    expect(updates).toHaveLength(0);
    // Still reported — an unchanged row does not make the shortfall go away.
    expect(result.discrepancies).toHaveLength(1);
  });

  it('degrades to an empty result when the courier has no settlement API', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SettlementSyncService,
        { provide: PrismaService, useValue: { client: {} } },
        {
          provide: ShipmentsService,
          useValue: { getPayments: jest.fn(() => Promise.resolve({ unavailable: true, reason: 'no api' })) },
        },
      ],
    }).compile();

    const result = await moduleRef.get(SettlementSyncService).sync('PATHAO');

    expect(result.shipmentsUpdated).toBe(0);
    expect(result.stopped).toBe('settlement API unavailable');
  });
});
