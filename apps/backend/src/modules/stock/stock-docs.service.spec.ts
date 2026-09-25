import { BadRequestException } from '@nestjs/common';
import { docNumber, StockDocsService } from './stock-docs.service';

describe('docNumber', () => {
  it('pads to 6 digits', () =>
    expect(docNumber('GRN', 'DHK1', 42)).toBe('GRN-DHK1-000042'));
});

describe('StockDocsService', () => {
  const stock = { move: jest.fn() };
  const tx = {
    store: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 1, code: 'DHK1' }),
    },
    stockIn: {
      create: jest.fn().mockResolvedValue({ id: 42 }),
      update: jest.fn(),
    },
  };
  const prisma = {
    client: {
      $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
      store: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ id: 1, isActive: true }),
      },
    },
  };
  const svc = new StockDocsService(prisma as never, stock as never);

  beforeEach(() => stock.move.mockReset());

  it('adjust: requires a note when reason is OTHER', async () => {
    await expect(
      svc.adjust(1, { productId: 1, qty: -1, reason: 'OTHER' } as never, 7),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(stock.move).not.toHaveBeenCalled();
  });

  it('adjust: moves stock with the reason recorded', async () => {
    await svc.adjust(
      1,
      { productId: 1, qty: -2, reason: 'DAMAGED' } as never,
      7,
    );
    expect(stock.move).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        storeId: 1,
        type: 'ADJUSTMENT',
        qty: -2,
        reason: 'DAMAGED',
      }),
    );
  });

  it('stock-in: numbers the GRN and adds every line to the store', async () => {
    const out = await svc.stockIn(
      1,
      {
        lines: [
          { productId: 5, qty: 10, unitCost: 80 },
          { productId: 6, variantId: 2, qty: 3 },
        ],
      },
      7,
    );
    expect(out).toEqual({ id: 42, number: 'GRN-DHK1-000042' });
    expect(stock.move).toHaveBeenCalledTimes(2);
    expect(stock.move).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        productId: 6,
        variantId: 2,
        type: 'STOCK_IN',
        qty: 3,
        stockInId: 42,
      }),
    );
  });
});

describe('StockDocsService.generateBarcodes', () => {
  it('fills only empty barcodes, per variant for variant products', async () => {
    const productUpdate = jest.fn();
    const variantUpdate = jest.fn();
    const prisma = {
      client: {
        product: {
          findMany: jest.fn().mockResolvedValue([
            { id: 1, hasVariants: false, barcode: null, variants: [] },
            {
              id: 2,
              hasVariants: false,
              barcode: '5901234123457',
              variants: [],
            },
            {
              id: 3,
              hasVariants: true,
              barcode: null,
              variants: [
                { id: 7, barcode: null },
                { id: 8, barcode: 'X' },
              ],
            },
          ]),
          update: productUpdate,
        },
        productVariant: { update: variantUpdate },
      },
    };
    const svc = new StockDocsService(prisma as never, {} as never);
    expect(await svc.generateBarcodes([1, 2, 3])).toEqual({ generated: 2 });
    expect(productUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { barcode: 'AMD00000100000' },
    });
    expect(variantUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { barcode: 'AMD00000300007' },
    });
  });
});

describe('StockDocsService — inactive store', () => {
  it('refuses stock-in and adjustments at an inactive store', async () => {
    const tx = {
      store: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ id: 1, code: 'X', isActive: false }),
      },
      stockIn: { create: jest.fn() },
    };
    const prisma = {
      client: {
        $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
        store: {
          findUniqueOrThrow: jest
            .fn()
            .mockResolvedValue({ id: 1, isActive: false }),
        },
      },
    };
    const move = jest.fn();
    const svc = new StockDocsService(prisma as never, { move } as never);
    await expect(
      svc.stockIn(1, { lines: [{ productId: 1, qty: 1 }] }, 7),
    ).rejects.toThrow(/inactive/i);
    await expect(
      svc.adjust(1, { productId: 1, qty: 1, reason: 'DAMAGED' } as never, 7),
    ).rejects.toThrow(/inactive/i);
    expect(move).not.toHaveBeenCalled();
  });
});
