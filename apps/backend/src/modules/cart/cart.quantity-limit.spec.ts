import { BadRequestException } from '@nestjs/common';
import { CartService } from './cart.service';

// The three ways a cart line's quantity grows, each capped at the lower of
// the product's own max and the store limit (Setting cart_max_quantity_per_item,
// default 30). Before this, change-quantity had no check at all — the path
// that let 1222 × honey through.
function make(opts: { storeMax?: unknown; productMax?: number | null; existingQty?: number } = {}) {
  const product = {
    id: 7,
    productType: 'PHYSICAL',
    status: 'PUBLISHED',
    deletedAt: null,
    hasVariants: false,
    minOrderQuantity: 1,
    maxOrderQuantity: opts.productMax ?? null,
    trackInventory: false,
    allowBackorder: false,
    stock: 0,
    reservedStock: 0,
    variants: [],
  };
  const client = {
    setting: {
      findUnique: jest.fn().mockResolvedValue(opts.storeMax === undefined ? null : { value: opts.storeMax }),
    },
    product: {
      findFirst: jest.fn().mockResolvedValue(product),
      findUnique: jest.fn().mockResolvedValue(product),
      findMany: jest.fn().mockResolvedValue([product]),
    },
    cart: {
      findFirst: jest.fn().mockResolvedValue({ id: 1 }),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    cartItem: {
      findFirst: jest.fn().mockResolvedValue(
        opts.existingQty === undefined
          ? null
          : { id: 9, cartId: 1, productId: 7, variantId: null, quantity: opts.existingQty, product },
      ),
      update: jest.fn(),
      create: jest.fn(),
    },
  };
  const pricing = { price: jest.fn().mockResolvedValue({ unitPrice: 100 }) };
  const svc = new CartService(client as never as never, pricing as never, { emit: jest.fn() } as never, {} as never, {} as never);
  (svc as unknown as { prisma: unknown }).prisma = { client };
  jest.spyOn(svc as never, 'buildView' as never).mockResolvedValue({} as never);
  jest.spyOn(svc as never, 'currentUnitPrice' as never).mockResolvedValue(100 as never);
  return { svc, client };
}

const id = { customerId: 1 } as never;

describe('cart quantity limit', () => {
  it('change-quantity rejects 1222 (the abuse case)', async () => {
    const { svc, client } = make({ existingQty: 1 });
    await expect(svc.updateItem(id, 9, 1222, 'EN')).rejects.toBeInstanceOf(BadRequestException);
    expect(client.cartItem.update).not.toHaveBeenCalled();
  });

  it('change-quantity allows exactly the limit', async () => {
    const { svc, client } = make({ existingQty: 1 });
    await svc.updateItem(id, 9, 30, 'EN');
    expect(client.cartItem.update).toHaveBeenCalled();
  });

  it('add checks the resulting line total, not just the amount added', async () => {
    const { svc, client } = make({ existingQty: 25 });
    await expect(svc.addItem(id, { productId: 7, quantity: 10 } as never, 'EN')).rejects.toBeInstanceOf(BadRequestException);
    expect(client.cartItem.update).not.toHaveBeenCalled();
  });

  it("a product's own lower max wins", async () => {
    const { svc } = make({ productMax: 5, existingQty: 1 });
    await expect(svc.updateItem(id, 9, 6, 'EN')).rejects.toThrow('at most 5');
  });

  it('the store limit is read from Settings', async () => {
    const { svc } = make({ storeMax: 50, existingQty: 1 });
    await expect(svc.updateItem(id, 9, 50, 'EN')).resolves.toBeDefined();
    await expect(svc.updateItem(id, 9, 51, 'EN')).rejects.toThrow('at most 50');
  });
});
