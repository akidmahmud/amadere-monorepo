import { Prisma } from '@amader/db';
import { assertWeighedLines, weighedLinePrice } from './weighed-price';

const D = (n: number | string) => new Prisma.Decimal(n);

describe('weighedLinePrice', () => {
  it('multiplies and rounds half up to whole taka', () => {
    expect(weighedLinePrice(D(300), '1.250').toString()).toBe('375');
    expect(weighedLinePrice(D(300), '1.225').toString()).toBe('368'); // 367.5
    expect(weighedLinePrice(D(300), '1.224').toString()).toBe('367'); // 367.2
    expect(weighedLinePrice(D('299.99'), '0.5').toString()).toBe('150'); // 149.995
  });
});

describe('assertWeighedLines', () => {
  const products: Record<number, { soldByWeight: boolean; name: string }> = {
    1: { soldByWeight: true, name: 'Frozen Chicken' },
    2: { soldByWeight: false, name: 'Oil' },
  };
  const get = (id: number) => products[id];

  it('accepts a weighed line with quantity 1 and a sane weight', () => {
    expect(() =>
      assertWeighedLines([{ productId: 1, quantity: 1, weighedKg: 1.25 }], get),
    ).not.toThrow();
    expect(() =>
      assertWeighedLines([{ productId: 2, quantity: 3 }], get),
    ).not.toThrow();
  });

  it.each([
    [{ productId: 1, quantity: 1 }, /enter its weight/],
    [{ productId: 1, quantity: 1, weighedKg: 0 }, /between/],
    [{ productId: 1, quantity: 1, weighedKg: 50.001 }, /between/],
    [{ productId: 1, quantity: 2, weighedKg: 1 }, /one line per item/],
    [{ productId: 2, quantity: 1, weighedKg: 1 }, /not sold by weight/],
  ])('rejects %j', (line, msg) => {
    expect(() => assertWeighedLines([line], get)).toThrow(msg);
  });
});
