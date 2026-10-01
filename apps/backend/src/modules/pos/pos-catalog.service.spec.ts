import { Prisma } from '@amader/db';
import { PosCatalogService } from './pos-catalog.service';

const D = (n: number) => new Prisma.Decimal(n);

function product(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    slug: 'coke',
    sku: 'COKE',
    barcode: '123',
    price: D(40),
    salePrice: null,
    hasVariants: false,
    trackInventory: true,
    storeId: null,
    translations: [{ name: 'Coca-Cola' }],
    variants: [],
    media: [],
    categories: [{ categoryId: 3 }],
    ...over,
  };
}

describe('PosCatalogService.list', () => {
  const findMany = jest.fn();
  const prisma = {
    client: {
      product: { findMany },
      storePrice: { findMany: jest.fn().mockResolvedValue([]) },
    },
  };
  const stock = {
    quantities: jest.fn().mockResolvedValue(
      new Map([
        ['1:0', 7],
        ['2:5', 2],
      ]),
    ),
  };
  const svc = new PosCatalogService(prisma as never, stock as never);

  beforeEach(() => findMany.mockReset());

  it("shows shared + this store's products only, never drafts", async () => {
    findMany.mockResolvedValue([]);
    await svc.list(2);
    const where = findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([{ storeId: null }, { storeId: 2 }]);
    expect(where.status).toEqual({ in: ['PUBLISHED', 'ADMIN_ONLY'] });
    expect(where.deletedAt).toBeNull();
    // A counter sells physical goods; ebooks/downloads stay online-only.
    expect(where.productType).toEqual({ not: 'DIGITAL' });
    // Products removed from this store only are not offered here.
    expect(where.storePrices).toEqual({
      none: { storeId: 2, variantId: null, hidden: true },
    });
  });

  it('maps simple and variant products with per-store stock', async () => {
    findMany.mockResolvedValue([
      product(),
      product({
        id: 2,
        hasVariants: true,
        storeId: 2,
        barcode: null,
        variants: [
          {
            id: 5,
            sku: 'ATTA-1KG',
            barcode: 'AMD1',
            price: D(90),
            salePrice: D(85),
            attributeValues: [
              { attributeValue: { translations: [{ value: '1kg' }] } },
            ],
          },
        ],
      }),
    ]);
    const out = await svc.list(2);
    expect(out).toEqual([
      expect.objectContaining({
        productId: 1,
        variantId: null,
        name: 'Coca-Cola',
        price: '40.00',
        stock: 7,
        storeOnly: false,
      }),
      expect.objectContaining({
        productId: 2,
        variantId: 5,
        variantLabel: '1kg',
        barcode: 'AMD1',
        salePrice: '85.00',
        stock: 2,
        storeOnly: true,
      }),
    ]);
  });
});

describe('PosCatalogService.lookup — exact only', () => {
  it('404s on a partial code instead of guessing the first fuzzy match', async () => {
    const prisma = {
      client: {
        product: { findMany: jest.fn().mockResolvedValue([]) },
        storePrice: { findMany: jest.fn().mockResolvedValue([]) },
      },
    };
    const stock = { quantities: jest.fn().mockResolvedValue(new Map()) };
    const svc = new PosCatalogService(prisma as never, stock as never);
    const list = jest.spyOn(svc, 'list').mockResolvedValue([
      {
        productId: 1,
        variantId: null,
        name: 'Honey',
        barcode: 'AMD00000100000',
        sku: 'HONEY-1KG',
      } as never,
    ]);
    await expect(svc.lookup(1, 'HONEY')).rejects.toThrow(/No product/);
    await expect(svc.lookup(1, 'HONEY-1KG')).resolves.toEqual(
      expect.objectContaining({ productId: 1 }),
    );
    await expect(svc.lookup(1, 'AMD00000100000')).resolves.toEqual(
      expect.objectContaining({ productId: 1 }),
    );
    // A scanner that doesn't send Shift types lower case.
    await expect(svc.lookup(1, 'amd00000100000')).resolves.toEqual(
      expect.objectContaining({ productId: 1 }),
    );
    list.mockRestore();
  });
});

describe('PosCatalogService.stats', () => {
  it('splits out-of-stock (≤ 0) from low stock (1–10), like the product cards', async () => {
    const prisma = {
      client: {
        order: {
          aggregate: jest.fn().mockResolvedValue({
            _sum: { totalAmount: null },
            _count: { _all: 0 },
          }),
        },
        orderItem: {
          aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: null } }),
        },
      },
    };
    const svc = new PosCatalogService(prisma as never, {} as never);
    jest
      .spyOn(svc, 'list')
      .mockResolvedValue(
        [0, -3, 5, 10, 11].map((stock) => ({ stock })) as never,
      );
    const s = await svc.stats(1);
    expect(s).toMatchObject({ totalProducts: 5, outOfStock: 2, lowStock: 2 });
  });
});
