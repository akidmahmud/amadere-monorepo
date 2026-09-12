import { PrismaService } from '../../../common/prisma/prisma.service';
import { RecoveryService } from './recovery.service';

/**
 * The two things the export promises and nothing else checks: the product
 * column carries SKUs rather than product names, and `ids` narrows the file to
 * the rows the screen had ticked.
 */
function cartItem(overrides: Record<string, unknown> = {}) {
  return {
    productId: 1,
    variantId: null,
    name: 'সরিষার তেল ৫০০ মিলি',
    slug: 'shorishar-tel',
    quantity: 2,
    unitPrice: '390.00',
    imageUrl: null,
    ...overrides,
  };
}

function incompleteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    name: 'Karim',
    phone: '01700000000',
    email: null,
    cart: [cartItem()],
    subtotal: { toString: () => '780.00' },
    stage: 'checkout',
    recovered: false,
    canceledAt: null,
    cancelReason: null,
    recoveryAttempts: 0,
    lastSeenAt: new Date('2026-09-01T10:00:00.000Z'),
    createdAt: new Date('2026-09-01T09:00:00.000Z'),
    ...overrides,
  };
}

function serviceWith(rows: unknown[], products: unknown[], variants: unknown[]) {
  const findMany = jest.fn().mockResolvedValue(rows);
  const prisma = {
    client: {
      incompleteOrder: { findMany },
      product: { findMany: jest.fn().mockResolvedValue(products) },
      productVariant: { findMany: jest.fn().mockResolvedValue(variants) },
      customer: { findMany: jest.fn().mockResolvedValue([]) },
    },
  } as unknown as PrismaService;
  const service = new RecoveryService(
    prisma,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, findMany };
}

describe('RecoveryService.exportCsv', () => {
  it('writes the SKU, not the product name, for each cart line', async () => {
    const { service } = serviceWith(
      [incompleteRow()],
      [{ id: 1, sku: 'MUS-500' }],
      [],
    );

    const csv = await service.exportCsv({ outcome: 'all' });

    expect(csv.split('\n')[0]).toContain('skus');
    expect(csv).toContain('2 x MUS-500');
    expect(csv).not.toContain('সরিষার তেল');
  });

  it('prefers the variant SKU when the line names a variant', async () => {
    const { service } = serviceWith(
      [incompleteRow({ cart: [cartItem({ variantId: 7 })] })],
      [{ id: 1, sku: 'MUS-500' }],
      [{ id: 7, sku: 'MUS-500-PACK3' }],
    );

    expect(await service.exportCsv({ outcome: 'all' })).toContain(
      '2 x MUS-500-PACK3',
    );
  });

  it('falls back to the name when the product has no SKU recorded', async () => {
    const { service } = serviceWith([incompleteRow()], [{ id: 1, sku: null }], []);

    expect(await service.exportCsv({ outcome: 'all' })).toContain(
      '2 x সরিষার তেল ৫০০ মিলি',
    );
  });

  it('narrows to the ticked rows when ids are given', async () => {
    const { service, findMany } = serviceWith([incompleteRow()], [], []);

    await service.exportCsv({ outcome: 'all', ids: [11, 12] });

    expect(findMany.mock.calls[0][0].where.id).toEqual({ in: [11, 12] });
  });

  it('exports everything the filters match when no ids are given', async () => {
    const { service, findMany } = serviceWith([incompleteRow()], [], []);

    await service.exportCsv({ outcome: 'all' });

    expect(findMany.mock.calls[0][0].where.id).toBeUndefined();
  });
});
