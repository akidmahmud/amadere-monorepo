import { BadRequestException } from '@nestjs/common';
import { StockService, stockKey } from './stock.service';

function makeTx(opts: {
  online: boolean;
  affected?: number;
  trackInventory?: boolean;
  productType?: string;
}) {
  return {
    store: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 1,
        name: 'Dhanmondi',
        isOnlineStore: opts.online,
      }),
    },
    product: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 10,
        trackInventory: opts.trackInventory ?? true,
        allowBackorder: false,
        hasVariants: false,
        productType: opts.productType ?? 'PHYSICAL',
      }),
    },
    $executeRaw: jest.fn().mockResolvedValue(opts.affected ?? 1),
    stockMovement: { create: jest.fn() },
  };
}

describe('StockService.move', () => {
  const svc = new StockService({ client: {} } as never);
  const base = { storeId: 1, productId: 10, variantId: null, adminUserId: 7 };

  it('records a movement when the conditional update succeeds', async () => {
    const tx = makeTx({ online: false });
    await svc.move(tx as never, { ...base, type: 'SALE', qty: -2 });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        storeId: 1,
        productId: 10,
        variantId: null,
        type: 'SALE',
        qty: -2,
      }),
    });
  });

  it('refuses an outflow that would go negative (last unit sold twice)', async () => {
    const tx = makeTx({ online: false, affected: 0 });
    await expect(
      svc.move(tx as never, { ...base, type: 'SALE', qty: -1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it('online-store outflow also refuses when reserved stock would be oversold', async () => {
    const tx = makeTx({ online: true, affected: 0 });
    await expect(
      svc.move(tx as never, { ...base, type: 'SALE', qty: -1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('skips untracked and digital products entirely', async () => {
    for (const p of [{ trackInventory: false }, { productType: 'DIGITAL' }]) {
      const tx = makeTx({ online: false, ...p });
      await svc.move(tx as never, { ...base, type: 'SALE', qty: -5 });
      expect(tx.$executeRaw).not.toHaveBeenCalled();
      expect(tx.stockMovement.create).not.toHaveBeenCalled();
    }
  });

  it('ignores qty 0', async () => {
    const tx = makeTx({ online: false });
    await svc.move(tx as never, { ...base, type: 'ADJUSTMENT', qty: 0 });
    expect(tx.store.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});

describe('stockKey', () => {
  it('uses 0 for simple products', () => {
    expect(stockKey(5, null)).toBe('5:0');
    expect(stockKey(5, 9)).toBe('5:9');
  });
});

describe('StockService.move — variant must match the product', () => {
  const svc = new StockService({ client: {} } as never);
  function tx(product: Record<string, unknown>, variant: unknown) {
    return {
      store: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ id: 1, name: 'S', isOnlineStore: true }),
      },
      product: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 10,
          trackInventory: true,
          allowBackorder: false,
          productType: 'PHYSICAL',
          hasVariants: false,
          ...product,
        }),
      },
      productVariant: { findFirst: jest.fn().mockResolvedValue(variant) },
      $executeRaw: jest.fn().mockResolvedValue(1),
      stockMovement: { create: jest.fn() },
    };
  }
  const base = {
    storeId: 1,
    productId: 10,
    adminUserId: 7,
    type: 'STOCK_IN' as const,
    qty: 1,
  };

  it('refuses a variant of another product (would move the wrong stock)', async () => {
    const t = tx({ hasVariants: true }, null);
    await expect(
      svc.move(t as never, { ...base, variantId: 99 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(t.productVariant.findFirst).toHaveBeenCalledWith({
      where: { id: 99, productId: 10 },
    });
    expect(t.$executeRaw).not.toHaveBeenCalled();
  });

  it('refuses a variant product without a variant', async () => {
    const t = tx({ hasVariants: true }, null);
    await expect(
      svc.move(t as never, { ...base, variantId: null }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a variant on a simple product', async () => {
    const t = tx({ hasVariants: false }, { id: 5 });
    await expect(
      svc.move(t as never, { ...base, variantId: 5 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts a matching variant', async () => {
    const t = tx({ hasVariants: true }, { id: 5, productId: 10 });
    await svc.move(t as never, { ...base, variantId: 5 });
    expect(t.$executeRaw).toHaveBeenCalled();
  });
});

describe("StockService.move — another store's store-only product", () => {
  it('refuses moving a product that belongs to a different store', async () => {
    const svc = new StockService({ client: {} } as never);
    const tx = {
      store: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ id: 1, name: 'A', isOnlineStore: false }),
      },
      product: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 10,
          storeId: 2,
          hasVariants: false,
          trackInventory: true,
          productType: 'PHYSICAL',
        }),
      },
      $executeRaw: jest.fn(),
      stockMovement: { create: jest.fn() },
    };
    await expect(
      svc.move(tx as never, {
        storeId: 1,
        productId: 10,
        variantId: null,
        type: 'STOCK_IN',
        qty: 1,
        adminUserId: 7,
      }),
    ).rejects.toThrow(/only sold at another store/i);
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });
});

describe('StockService.move — a sale/return of a product later moved to another store still works', () => {
  it('SALE and RETURN are not blocked by the store-only check', async () => {
    const svc = new StockService({ client: {} } as never);
    const tx = {
      store: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ id: 1, name: 'A', isOnlineStore: false }),
      },
      product: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 10,
          storeId: 2,
          hasVariants: false,
          trackInventory: true,
          productType: 'PHYSICAL',
        }),
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
      stockMovement: { create: jest.fn() },
    };
    await svc.move(tx as never, {
      storeId: 1,
      productId: 10,
      variantId: null,
      type: 'RETURN',
      qty: 1,
      adminUserId: 7,
    });
    expect(tx.$executeRaw).toHaveBeenCalled();
  });
});
