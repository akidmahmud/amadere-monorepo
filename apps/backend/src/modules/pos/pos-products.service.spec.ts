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
