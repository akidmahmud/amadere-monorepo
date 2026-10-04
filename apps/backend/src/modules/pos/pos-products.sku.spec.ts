import { PosProductsService } from './pos-products.service';

const costs = { recordIfChanged: jest.fn() };

function make(product: Record<string, unknown> | null, updateError?: unknown) {
  const update = updateError
    ? jest.fn().mockRejectedValue(updateError)
    : jest.fn().mockResolvedValue({});
  const prisma = {
    client: {
      product: { findFirst: jest.fn().mockResolvedValue(product), update },
      productVariant: { update: jest.fn().mockResolvedValue({}) },
    },
  };
  return { svc: new PosProductsService(prisma as never, {} as never, costs as never), prisma };
}
const own = { storeId: 4, hasVariants: false, variants: [] };
const shared = { storeId: null, hasVariants: true, variants: [{ id: 9 }] };
const yes = () => true;
const posOnly = (k: string) => k !== 'product.update';

describe('PosProductsService.setSku', () => {
  it("a store's own product: POS staff can change it (trimmed)", async () => {
    const { svc, prisma } = make(own);
    await expect(svc.setSku(4, 1, null, '  OIL-1L ', posOnly)).resolves.toEqual({ sku: 'OIL-1L' });
    expect(prisma.client.product.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { sku: 'OIL-1L' } });
  });

  it('a shared product needs product.update; then the size’s SKU changes', async () => {
    await expect(make(shared).svc.setSku(4, 1, 9, 'X', posOnly)).rejects.toThrow(/shared with the website/);
    const { svc, prisma } = make(shared);
    await svc.setSku(4, 1, 9, 'X', yes);
    expect(prisma.client.productVariant.update).toHaveBeenCalledWith({ where: { id: 9 }, data: { sku: 'X' } });
  });

  it('a taken SKU gets a plain message', async () => {
    const { svc } = make(own, { code: 'P2002' });
    await expect(svc.setSku(4, 1, null, 'DUP', yes)).rejects.toThrow('SKU "DUP" is already used by another product');
  });

  it('blank clears it; the wrong size is refused', async () => {
    const { svc, prisma } = make(own);
    await svc.setSku(4, 1, null, '  ', yes);
    expect(prisma.client.product.update.mock.calls[0][0].data).toEqual({ sku: null });
    await expect(make(shared).svc.setSku(4, 1, 7, 'X', yes)).rejects.toThrow(/does not belong/);
  });
});

describe('PosProductsService.setCost', () => {
  it("records the shop's cost for its own product in the cost history", async () => {
    costs.recordIfChanged.mockClear();
    const { svc } = make(own);
    await expect(svc.setCost(4, 1, null, 85.5, 7)).resolves.toEqual({ cost: '85.50' });
    expect(costs.recordIfChanged).toHaveBeenCalledWith({ productId: 1, variantId: null, cost: 85.5 }, 7);
  });

  it('refuses shared products and other stores’ products', async () => {
    costs.recordIfChanged.mockClear();
    await expect(make(shared).svc.setCost(4, 1, 9, 10, 7)).rejects.toThrow(/website cost/);
    await expect(make({ ...own, storeId: 5 }).svc.setCost(4, 1, null, 10, 7)).rejects.toThrow(/website cost/);
    expect(costs.recordIfChanged).not.toHaveBeenCalled();
  });
});
