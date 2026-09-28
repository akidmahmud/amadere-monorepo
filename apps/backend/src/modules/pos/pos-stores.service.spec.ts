import { PosStoresService } from './pos-stores.service';

describe('PosStoresService.duplicate', () => {
  function make(existingCode: object | null = null) {
    const c = {
      store: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 2, address: 'Uttara', phone: '017', isActive: true,
          cashAccountId: 5, cardAccountId: 6, mobileAccountId: null,
        }),
        findUnique: jest.fn().mockResolvedValue(existingCode),
      },
      posInvoiceTemplate: {
        findFirst: jest.fn().mockResolvedValue({ html: '<p>x</p>', updatedById: 1 }),
        create: jest.fn(),
      },
      storePrice: {
        findMany: jest.fn().mockResolvedValue([
          { productId: 10, variantId: null, price: 99, salePrice: null, name: 'Uttara Ghee', updatedById: 1 },
        ]),
        createMany: jest.fn(),
      },
      product: {
        findMany: jest.fn().mockResolvedValue([
          { id: 30, translations: [{ locale: 'EN', name: 'Pickle' }] },
        ]),
        update: jest.fn(),
      },
      productTranslation: { updateMany: jest.fn() },
    };
    const stores = { create: jest.fn().mockResolvedValue({ id: 9, name: 'Mirpur' }) };
    const products = { duplicate: jest.fn().mockResolvedValue({ id: 31 }) };
    return {
      svc: new PosStoresService({ client: c } as never, stores as never, products as never),
      c, stores, products,
    };
  }

  it('copies settings, accounts, receipt, shared-product overrides and own products (to the new store, same name)', async () => {
    const { svc, c, stores, products } = make();
    const out = await svc.duplicate(2, 'Mirpur', 'MIR');
    expect(stores.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Mirpur', code: 'MIR', address: 'Uttara', cashAccountId: 5, cardAccountId: 6 }),
    );
    expect(c.posInvoiceTemplate.create).toHaveBeenCalledWith({ data: { storeId: 9, html: '<p>x</p>', updatedById: 1 } });
    expect(c.storePrice.findMany.mock.calls[0][0].where).toEqual({ storeId: 2, product: { storeId: null } });
    expect(c.storePrice.createMany.mock.calls[0][0].data[0]).toEqual(expect.objectContaining({ storeId: 9, productId: 10, name: 'Uttara Ghee' }));
    expect(products.duplicate).toHaveBeenCalledWith(30);
    expect(c.product.update).toHaveBeenCalledWith({ where: { id: 31 }, data: { storeId: 9 } });
    expect(c.productTranslation.updateMany).toHaveBeenCalledWith({ where: { productId: 31, locale: 'EN' }, data: { name: 'Pickle' } });
    expect(out.copied).toEqual({ products: 1, overrides: 1, invoiceTemplate: true });
  });

  it('refuses a code already in use', async () => {
    await expect(make({ id: 3 }).svc.duplicate(2, 'X', 'MAIN')).rejects.toThrow(/already used/);
  });
});
