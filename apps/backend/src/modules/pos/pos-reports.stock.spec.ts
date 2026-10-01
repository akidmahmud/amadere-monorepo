import { PosReportsService } from './pos-reports.service';

describe('PosReportsService.stock', () => {
  it('opening + in − sold + returned ± adjust + transfers = closing, anchored on today’s count', async () => {
    // Today on hand: 14. After the period: 1 more sold (−1), so closing 15.
    // In the period: +20 stock in, −8 sold, +1 returned, −2 adjusted,
    // +5 transferred in, −3 transferred out → net +13, so opening 2.
    const groupBy = jest
      .fn()
      .mockResolvedValueOnce([
        { productId: 1, variantId: null, type: 'STOCK_IN', _sum: { qty: 20 } },
        { productId: 1, variantId: null, type: 'SALE', _sum: { qty: -8 } },
        { productId: 1, variantId: null, type: 'RETURN', _sum: { qty: 1 } },
        { productId: 1, variantId: null, type: 'ADJUSTMENT', _sum: { qty: -2 } },
        { productId: 1, variantId: null, type: 'TRANSFER_IN', _sum: { qty: 5 } },
        { productId: 1, variantId: null, type: 'TRANSFER_OUT', _sum: { qty: -3 } },
      ])
      .mockResolvedValueOnce([{ productId: 1, variantId: null, _sum: { qty: -1 } }]);
    const catalog = {
      list: jest.fn().mockResolvedValue([
        { productId: 1, variantId: null, name: 'Oil', sku: 'OIL', barcode: null, stock: 14 },
        { productId: 2, variantId: 9, name: 'Salt', variantLabel: '1KG', sku: 'S1', barcode: 'B', stock: 3 },
        { productId: 3, variantId: null, name: 'Service', stock: 9999 },
      ]),
    };
    const svc = new PosReportsService(
      { client: { stockMovement: { groupBy } } } as never,
      catalog as never,
    );
    const rows = await svc.stock(4, '2026-10-01', '2026-10-02');
    expect(rows).toHaveLength(2); // untracked left out
    expect(rows[0]).toMatchObject({
      opening: 2,
      stockIn: 20,
      sold: 8,
      returned: 1,
      adjustment: -2,
      transferIn: 5,
      transferOut: 3,
      closing: 15,
      status: 'In stock',
    });
    expect(rows[1]).toMatchObject({ name: 'Salt (1KG)', opening: 3, closing: 3, status: 'Low stock' });
    // the period is Dhaka days
    expect(groupBy.mock.calls[0][0].where.createdAt.gte).toEqual(new Date('2026-09-30T18:00:00Z'));
    expect(groupBy.mock.calls[1][0].where.createdAt.gte).toEqual(new Date('2026-10-02T18:00:00Z'));
  });
});
