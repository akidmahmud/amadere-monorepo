import { Prisma } from '@amader/db';
import { PricingService } from './pricing.service';

const D = (n: number) => new Prisma.Decimal(n);

function make(storePrices: object[]) {
  const client = {
    product: {
      findMany: jest.fn().mockResolvedValue([
        { id: 1, price: D(300), salePrice: D(280), saleStartsAt: null, saleEndsAt: null, variants: [] },
        {
          id: 2, price: null, salePrice: null, saleStartsAt: null, saleEndsAt: null,
          variants: [{ id: 20, price: D(500), salePrice: null }],
        },
      ]),
    },
    storePrice: { findMany: jest.fn().mockResolvedValue(storePrices) },
  };
  return { svc: new PricingService({ client } as never, {} as never), client };
}

const lines = [
  { productId: 1, variantId: null, quantity: 2 },
  { productId: 2, variantId: 20, quantity: 1 },
];

describe('PricingService.priceLines — store prices (POS)', () => {
  it("uses the store's offer price, else its price, per SKU", async () => {
    const { svc } = make([
      { productId: 1, variantId: null, price: D(250), salePrice: D(240) },
      { productId: 2, variantId: 20, price: D(450), salePrice: null },
    ]);
    const out = await svc.priceLines(lines, 4);
    expect(out.map((l) => l.unitPrice.toString())).toEqual(['240', '450']);
    expect(out[0].lineTotal.toString()).toBe('480');
  });

  it('falls back to the normal price where the store set none', async () => {
    const { svc } = make([
      { productId: 2, variantId: 20, price: D(450), salePrice: null },
    ]);
    const out = await svc.priceLines(lines, 4);
    expect(out.map((l) => l.unitPrice.toString())).toEqual(['280', '450']);
  });

  it('the website (no store) never reads store prices', async () => {
    const { svc, client } = make([]);
    const out = await svc.priceLines(lines);
    expect(client.storePrice.findMany).not.toHaveBeenCalled();
    expect(out.map((l) => l.unitPrice.toString())).toEqual(['280', '500']);
  });
});
