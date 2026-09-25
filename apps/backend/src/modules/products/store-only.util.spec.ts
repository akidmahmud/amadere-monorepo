import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { applyStoreOnlyRules } from './store-only.util';

const can =
  (...keys: string[]) =>
  (k: string) =>
    keys.includes(k);

describe('applyStoreOnlyRules', () => {
  it('a catalog editor without POS permissions can edit a store product without moving it', () => {
    expect(applyStoreOnlyRules({}, { storeId: null, can: can() }, 4)).toEqual({ storeId: undefined, status: 'ADMIN_ONLY' });
    // …but still can't publish it
    expect(() => applyStoreOnlyRules({ status: 'PUBLISHED' }, { storeId: null, can: can() }, 4)).toThrow(BadRequestException);
  });

  it('shared product: untouched', () => {
    expect(
      applyStoreOnlyRules(
        { status: 'PUBLISHED' },
        { storeId: null, can: can() },
        null,
      ),
    ).toEqual({
      storeId: undefined,
      status: 'PUBLISHED',
    });
  });

  it('store product: forced ADMIN_ONLY so the storefront never shows it', () => {
    expect(
      applyStoreOnlyRules(
        { storeId: 2 },
        { storeId: 2, can: can('pos.store_products') },
        null,
      ),
    ).toEqual({
      storeId: 2,
      status: 'ADMIN_ONLY',
    });
  });

  it('refuses publishing an existing store-only product to the website', () => {
    expect(() =>
      applyStoreOnlyRules(
        { status: 'PUBLISHED' },
        { storeId: 2, can: can('pos.store_products') },
        2,
      ),
    ).toThrow(BadRequestException);
  });

  it('a manager cannot create for another store', () => {
    expect(() =>
      applyStoreOnlyRules(
        { storeId: 3 },
        { storeId: 2, can: can('pos.store_products') },
        null,
      ),
    ).toThrow(ForbiddenException);
  });

  it('an all-stores admin can', () => {
    expect(
      applyStoreOnlyRules(
        { storeId: 3 },
        { storeId: null, can: can('pos.all_stores') },
        null,
      ).storeId,
    ).toBe(3);
  });

  it('making a store product shared again keeps the requested status', () => {
    expect(
      applyStoreOnlyRules(
        { storeId: null, status: 'DRAFT' },
        { storeId: null, can: can('pos.all_stores') },
        2,
      ),
    ).toEqual({
      storeId: null,
      status: 'DRAFT',
    });
  });
});

import { ProductsService } from './products.service';

describe('ProductsService.duplicate — store-only products', () => {
  it("the copy stays at the same store and stays ADMIN_ONLY", async () => {
    const create = jest.fn().mockResolvedValue({ id: 99 });
    const fake = {
      adminGet: jest.fn().mockResolvedValue({
        slug: 'atta', storeId: 4, productType: 'PHYSICAL', hasVariants: false, trackInventory: true, allowBackorder: false,
        price: '90', salePrice: null, wholesalePrice: null, translations: [], categoryIds: [], tagIds: [], attributeIds: [],
        variants: [], images: [], media: [], faqs: [], keyBenefits: [], customLabels: [],
      }),
      prisma: { client: { product: { findUnique: jest.fn().mockResolvedValue(null) } } },
      create,
    };
    await ProductsService.prototype.duplicate.call(fake as never, 1);
    expect(create.mock.calls[0][0]).toEqual(expect.objectContaining({ storeId: 4, status: 'ADMIN_ONLY' }));
  });
});
