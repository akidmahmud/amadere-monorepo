import { ForbiddenException } from '@nestjs/common';
import { PosProductsService, slugify } from './pos-products.service';

const costs = { recordIfChanged: jest.fn() };

function make(existing: object | null = null) {
  const products = {
    create: jest.fn().mockResolvedValue({ id: 1 }),
    update: jest.fn(),
  };
  const prisma = {
    client: {
      product: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(existing),
        update: jest.fn(),
      },
    },
  };
  return {
    svc: new PosProductsService(prisma as never, products as never, costs as never),
    products,
  };
}
const actor = { storeId: 4, can: () => true };

describe('PosProductsService', () => {
  it('creates a store-only, ADMIN_ONLY simple product for the till store', async () => {
    const { svc, products } = make();
    await svc.create(4, { name: 'Mango Pickle', price: 250, sku: ' ' }, actor);
    const dto = products.create.mock.calls[0][0];
    expect(dto).toEqual(
      expect.objectContaining({
        storeId: 4,
        status: 'ADMIN_ONLY',
        price: 250,
        sku: undefined,
        translations: [{ locale: 'EN', name: 'Mango Pickle' }],
      }),
    );
    expect(dto.slug).toMatch(/^mango-pickle-[0-9a-f]{6}$/);
  });

  it("refuses to edit another store's or a shared product", async () => {
    const other = make({ storeId: 9, hasVariants: false });
    await expect(
      other.svc.update(4, 1, { name: 'x', price: 1 }, actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const shared = make({ storeId: null, hasVariants: false });
    await expect(
      shared.svc.update(4, 1, { name: 'x', price: 1 }, actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(other.products.update).not.toHaveBeenCalled();
  });

  it('edits its own product, clearing a removed sale price', async () => {
    const { svc, products } = make({ storeId: 4, hasVariants: false });
    await svc.update(4, 7, { name: 'x', price: 1 }, actor);
    expect(products.update.mock.calls[0][0]).toBe(7);
    expect(products.update.mock.calls[0][1].salePrice).toBeNull();
  });

  it('slugify falls back when the name has no latin letters', () => {
    expect(slugify('আম')).toBe('product');
  });
});

describe('PosProductsService.setPrice', () => {
  function mk(product: object | null, existing: object | null = null) {
    const storePrice = {
      findFirst: jest.fn().mockResolvedValue(existing),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
    };
    const prisma = {
      client: { product: { findFirst: jest.fn().mockResolvedValue(product) }, storePrice },
    };
    return { svc: new PosProductsService(prisma as never, {} as never, costs as never), storePrice };
  }
  const simple = { id: 1, hasVariants: false, variants: [] };

  it('creates, then updates, the store price for that store only', async () => {
    const a = mk(simple);
    await a.svc.setPrice(4, { productId: 1, price: 250, salePrice: 240 }, 7);
    expect(a.storePrice.create).toHaveBeenCalledWith({
      data: { storeId: 4, productId: 1, variantId: null, price: 250, salePrice: 240, name: null, weightKg: null, weightUnit: null, updatedById: 7 },
    });
    const b = mk(simple, { id: 9 });
    await b.svc.setPrice(4, { productId: 1, price: 260 }, 7);
    expect(b.storePrice.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { price: 260, salePrice: null, name: null, weightKg: null, weightUnit: null, updatedById: 7 },
    });
  });

  it('price null resets to the normal price', async () => {
    const { svc, storePrice } = mk(simple);
    await svc.setPrice(4, { productId: 1, price: null }, 7);
    // A "removed from this store" row (or one holding this store's photo)
    // survives a name/price reset.
    expect(storePrice.deleteMany).toHaveBeenCalledWith({
      where: { storeId: 4, productId: 1, variantId: null, hidden: false, mediaId: null },
    });
  });

  it('refuses an offer above the price, a missing variant, or a product not sold here', async () => {
    await expect(
      mk(simple).svc.setPrice(4, { productId: 1, price: 100, salePrice: 150 }, 7),
    ).rejects.toThrow(/Offer price/);
    await expect(
      mk({ id: 2, hasVariants: true, variants: [{ id: 20 }] }).svc.setPrice(4, { productId: 2, price: 1 }, 7),
    ).rejects.toThrow(/variant/);
    await expect(
      mk({ id: 2, hasVariants: true, variants: [{ id: 20 }] }).svc.setPrice(4, { productId: 2, variantId: 99, price: 1 }, 7),
    ).rejects.toThrow(/does not belong/);
    await expect(mk(null).svc.setPrice(4, { productId: 1, price: 1 }, 7)).rejects.toThrow(/not sold/);
  });
});

describe('PosProductsService — weight & duplicate', () => {
  it('saves the weight (kg) as the product weight, and null clears it', async () => {
    const products = { create: jest.fn().mockResolvedValue({ id: 1 }), update: jest.fn(), duplicate: jest.fn() };
    const productUpdate = jest.fn();
    const svc = new PosProductsService(
      { client: { product: { findUniqueOrThrow: jest.fn().mockResolvedValue({ storeId: 4, hasVariants: false }), update: productUpdate } } } as never,
      products as never, costs as never);
    await svc.create(4, { name: 'Oil', price: 900, weightKg: 0.5, weightUnit: 'ml' }, { storeId: 4, can: () => true });
    expect(products.create.mock.calls[0][0].shippableWeight).toBe(0.5);
    // 500 ml: stored as 0.5 (litres), shown in ml.
    expect(productUpdate).toHaveBeenCalledWith({ where: { id: 1 }, data: { weightUnit: 'ml' } });
    await svc.update(4, 1, { name: 'Ghee', price: 900, weightKg: null }, { storeId: 4, can: () => true });
    expect(products.update.mock.calls[0][1].shippableWeight).toBeNull();
    // No weight → no unit.
    expect(productUpdate).toHaveBeenLastCalledWith({ where: { id: 1 }, data: { weightUnit: null } });
  });

  it("duplicates this store's own products; never another store's", async () => {
    const products = { duplicate: jest.fn() };
    const mk = (storeId: number | null) =>
      new PosProductsService(
        { client: { product: { findUniqueOrThrow: jest.fn().mockResolvedValue({ storeId }) } } } as never,
        products as never, costs as never);
    products.duplicate.mockResolvedValue({ id: 8 });
    await mk(4).duplicate(4, 7);
    expect(products.duplicate).toHaveBeenCalledWith(7);
    await expect(mk(9).duplicate(4, 7)).rejects.toThrow(/does not belong/);
  });
});

describe('PosProductsService.setPrice — store name', () => {
  const mk = () => {
    const storePrice = {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
    };
    const prisma = {
      client: {
        product: { findFirst: jest.fn().mockResolvedValue({ id: 1, hasVariants: false, variants: [] }) },
        storePrice,
      },
    };
    return { svc: new PosProductsService(prisma as never, {} as never, costs as never), storePrice };
  };

  it('a name-only change keeps the normal price (price stays null)', async () => {
    const { svc, storePrice } = mk();
    await svc.setPrice(4, { productId: 1, name: '  Uttara Special Ghee ' }, 7);
    expect(storePrice.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ name: 'Uttara Special Ghee', price: null, salePrice: null }),
    );
  });

  it('blank name and no price removes the override; an offer needs a price', async () => {
    const a = mk();
    await a.svc.setPrice(4, { productId: 1, name: '  ', price: null }, 7);
    expect(a.storePrice.deleteMany).toHaveBeenCalled();
    await expect(mk().svc.setPrice(4, { productId: 1, salePrice: 50 }, 7)).rejects.toThrow(/price before an offer/);
  });
});

describe('PosProductsService.remove', () => {
  it("trashes only this store's own products", async () => {
    const products = { delete: jest.fn() };
    const mk = (storeId: number | null) =>
      new PosProductsService(
        { client: { product: { findUniqueOrThrow: jest.fn().mockResolvedValue({ storeId }) } } } as never,
        products as never, costs as never);
    await mk(4).remove(4, 7);
    expect(products.delete).toHaveBeenCalledWith(7);
    await expect(mk(9).remove(4, 7)).rejects.toThrow(/does not belong/);
    await expect(mk(null).remove(4, 7)).rejects.toThrow(/does not belong/);
  });
});

describe('PosProductsService — remove a shared product from one store', () => {
  const mk = (product: object | null, existing: object | null = null) => {
    const storePrice = {
      findFirst: jest.fn().mockResolvedValue(existing),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
    };
    const prisma = { client: { product: { findFirst: jest.fn().mockResolvedValue(product) }, storePrice } };
    return { svc: new PosProductsService(prisma as never, {} as never, costs as never), storePrice };
  };

  it('hides a shared product at this store only (product-level row)', async () => {
    const { svc, storePrice } = mk({ storeId: null });
    await svc.hide(4, 10, 7);
    expect(storePrice.create).toHaveBeenCalledWith({
      data: { storeId: 4, productId: 10, variantId: null, hidden: true, updatedById: 7 },
    });
  });

  it("keeps this store's name/price when hiding and when putting back", async () => {
    const a = mk({ storeId: null }, { id: 3 });
    await a.svc.hide(4, 10, 7);
    expect(a.storePrice.update).toHaveBeenCalledWith({ where: { id: 3 }, data: { hidden: true, updatedById: 7 } });
    const b = mk(null);
    await b.svc.unhide(4, 10);
    expect(b.storePrice.deleteMany).toHaveBeenCalledWith({
      where: { storeId: 4, productId: 10, variantId: null, hidden: true, name: null, price: null, weightKg: null, mediaId: null },
    });
    expect(b.storePrice.updateMany).toHaveBeenCalledWith({
      where: { storeId: 4, productId: 10, variantId: null },
      data: { hidden: false },
    });
  });

  it("refuses a store's own product (that one is deleted instead)", async () => {
    await expect(mk({ storeId: 4 }).svc.hide(4, 10, 7)).rejects.toThrow(/delete it instead/);
  });
});

describe('PosProductsService.restore', () => {
  it("restores only this store's own products", async () => {
    const products = { restore: jest.fn() };
    const mk = (storeId: number | null) =>
      new PosProductsService(
        { client: { product: { findUniqueOrThrow: jest.fn().mockResolvedValue({ storeId }) } } } as never,
        products as never, costs as never);
    await mk(4).restore(4, 7);
    expect(products.restore).toHaveBeenCalledWith(7);
    await expect(mk(9).restore(4, 7)).rejects.toThrow(/does not belong/);
  });
});

describe('PosProductsService.setPrice — store weight', () => {
  it('a weight-only change is kept (name/price stay normal)', async () => {
    const storePrice = { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn(), deleteMany: jest.fn(), updateMany: jest.fn() };
    const svc = new PosProductsService(
      { client: { product: { findFirst: jest.fn().mockResolvedValue({ id: 1, hasVariants: false, variants: [] }) }, storePrice } } as never,
      {} as never, costs as never);
    await svc.setPrice(4, { productId: 1, weightKg: 0.5 }, 7);
    expect(storePrice.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ weightKg: 0.5, price: null, name: null }),
    );
    expect(storePrice.deleteMany).not.toHaveBeenCalled();
  });
});

describe('PosProductsService.duplicate — shared product', () => {
  it('a shared product is copied as this store own product (ADMIN_ONLY, not on the website)', async () => {
    const update = jest.fn();
    const products = { duplicate: jest.fn().mockResolvedValue({ id: 99 }) };
    const svc = new PosProductsService(
      { client: { product: { findUniqueOrThrow: jest.fn().mockResolvedValue({ storeId: null }), update } } } as never,
      products as never, costs as never);
    expect(await svc.duplicate(4, 7)).toEqual({ id: 99 });
    expect(update).toHaveBeenCalledWith({ where: { id: 99 }, data: { storeId: 4, status: 'ADMIN_ONLY' } });
  });
});
