import { ForbiddenException } from '@nestjs/common';
import { PosProductsService, slugify } from './pos-products.service';

function make(existing: object | null = null) {
  const products = { create: jest.fn(), update: jest.fn() };
  const prisma = {
    client: {
      product: { findUniqueOrThrow: jest.fn().mockResolvedValue(existing) },
    },
  };
  return {
    svc: new PosProductsService(prisma as never, products as never),
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
    };
    const prisma = {
      client: { product: { findFirst: jest.fn().mockResolvedValue(product) }, storePrice },
    };
    return { svc: new PosProductsService(prisma as never, {} as never), storePrice };
  }
  const simple = { id: 1, hasVariants: false, variants: [] };

  it('creates, then updates, the store price for that store only', async () => {
    const a = mk(simple);
    await a.svc.setPrice(4, { productId: 1, price: 250, salePrice: 240 }, 7);
    expect(a.storePrice.create).toHaveBeenCalledWith({
      data: { storeId: 4, productId: 1, variantId: null, price: 250, salePrice: 240, updatedById: 7 },
    });
    const b = mk(simple, { id: 9 });
    await b.svc.setPrice(4, { productId: 1, price: 260 }, 7);
    expect(b.storePrice.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { price: 260, salePrice: null, updatedById: 7 },
    });
  });

  it('price null resets to the normal price', async () => {
    const { svc, storePrice } = mk(simple);
    await svc.setPrice(4, { productId: 1, price: null }, 7);
    expect(storePrice.deleteMany).toHaveBeenCalledWith({
      where: { storeId: 4, productId: 1, variantId: null },
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
