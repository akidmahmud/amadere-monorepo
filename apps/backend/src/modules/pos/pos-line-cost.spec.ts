import { Prisma } from '@amader/db';
import { lineCoster } from './pos-line-cost';

const D = (n: number | string) => new Prisma.Decimal(n);
const noHistory = { loadResolver: async () => ({ resolve: () => null }) };

describe('lineCoster', () => {
  it('a weighed line costs cost/kg × its own weight', async () => {
    const line = {
      productId: 1,
      variantId: null,
      weighedKg: D('1.25'),
      product: {
        shippableWeight: null,
        costPerItem: D(250),
        costPriceUnit: 'PER_KG' as const,
      },
    };
    const cost = await lineCoster(noHistory as never, [line]);
    expect(cost(line, '2026-10-16')).toBe('312.50');
  });

  it('a normal line is unchanged', async () => {
    const line = {
      productId: 2,
      variantId: null,
      product: { shippableWeight: D(1), costPerItem: D(90), costPriceUnit: null },
    };
    const cost = await lineCoster(noHistory as never, [line]);
    expect(cost(line, '2026-10-16')).toBe('90.00');
  });
});
