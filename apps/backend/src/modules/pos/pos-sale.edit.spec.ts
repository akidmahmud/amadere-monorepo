import { Prisma } from '@amader/db';
import { PosSaleService } from './pos-sale.service';

const D = (n: number) => new Prisma.Decimal(n);

// Sale: 2 × Oil at ৳50 (sold price; today it costs ৳60), no discount, no VAT.
function make(overrides: Record<string, unknown> = {}) {
  const order = {
    id: 5,
    storeId: 4,
    status: 'COMPLETED',
    deletedAt: null,
    updatedAt: new Date('2026-09-30T00:00:00Z'),
    subTotal: D(100),
    discountAmount: D(0),
    posManualDiscount: D(0),
    posVatDiscount: D(0),
    posRefundedAmount: D(0),
    taxAmount: D(0),
    totalAmount: D(100),
    tenderedAmount: D(100),
    payments: [{ provider: 'CASH', transactionRef: null }],
    items: [
      { id: 1, productId: 10, variantId: null, quantity: 2, unitPrice: D(50), restockedQuantity: 0, productNameSnapshot: 'Oil' },
    ],
    ...overrides,
  };
  const tx = {
    order: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    orderItem: { update: jest.fn(), delete: jest.fn(), create: jest.fn() },
    payment: { updateMany: jest.fn() },
    orderStatusHistory: { create: jest.fn() },
  };
  const product = (id: number, name: string) => ({
    id, sku: `S${id}`, slug: name, productType: 'PHYSICAL', vatRatePercent: null,
    translations: [{ name }], variants: [],
  });
  const prisma = {
    client: {
      product: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([product(10, 'Oil'), product(11, 'Salt')])
          .mockResolvedValueOnce([{ id: 11 }]),
      },
      storePrice: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: (f: (t: typeof tx) => Promise<unknown>) => f(tx),
    },
  };
  const stock = { move: jest.fn() };
  const stores = { tenderAccountId: jest.fn().mockResolvedValue(11) };
  const pricing = { priceLines: jest.fn().mockResolvedValue([{ unitPrice: '20' }]) };
  const salesPosting = { postPrepaidCapture: jest.fn(), postRefund: jest.fn() };
  const settings = {
    getVat: jest.fn().mockResolvedValue({ enabled: false, ratePercent: 0, pricesIncludeVat: false, vatDiscount: false }),
  };
  const svc = new PosSaleService(
    prisma as never, stock as never, stores as never, pricing as never,
    salesPosting as never, settings as never, {} as never, {} as never,
  );
  jest.spyOn(svc, 'get').mockResolvedValue(order as never);
  return { svc, tx, stock, salesPosting };
}

describe('PosSaleService.editSale', () => {
  it('Oil 2→3 at its sold price, Salt added at today’s price: stock out, extra collected', async () => {
    const { svc, tx, stock, salesPosting } = make();
    const r = await svc.editSale(4, 5, 7, [
      { productId: 10, quantity: 3 },
      { productId: 11, quantity: 1 },
    ]);
    expect(r.total).toBe('170.00'); // 3 × 50 + 20
    expect(r.difference).toBe('70.00');
    expect(tx.orderItem.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { quantity: 3 } });
    expect(tx.orderItem.create.mock.calls[0][0].data).toMatchObject({ productId: 11, quantity: 1, unitPrice: D(20) });
    expect(stock.move.mock.calls.map((c) => [c[1].productId, c[1].type, c[1].qty])).toEqual([
      [10, 'SALE', -1],
      [11, 'SALE', -1],
    ]);
    expect(salesPosting.postPrepaidCapture).toHaveBeenCalledWith(expect.objectContaining({ amount: D(70), accountId: 11 }));
    expect(salesPosting.postRefund).not.toHaveBeenCalled();
    // cash received grows with the total, so the receipt shows no negative change
    expect(tx.order.updateMany.mock.calls[0][0].data.tenderedAmount).toEqual(D(170));
  });

  it('removing a line puts its stock back and refunds the difference', async () => {
    const { svc, tx, stock, salesPosting } = make();
    const r = await svc.editSale(4, 5, 7, [{ productId: 10, quantity: 1 }]);
    expect(r.difference).toBe('-50.00');
    expect(stock.move.mock.calls[0][1]).toMatchObject({ type: 'RETURN', qty: 1 });
    expect(salesPosting.postRefund).toHaveBeenCalledWith(expect.objectContaining({ amount: D(50) }));
    expect(tx.payment.updateMany).toHaveBeenCalledWith({ where: { orderId: 5 }, data: { amount: D(50) } });
  });

  it('dry run previews without writing', async () => {
    const { svc, tx, stock } = make();
    const r = await svc.editSale(4, 5, 7, [{ productId: 10, quantity: 4 }], { dryRun: true });
    expect(r).toMatchObject({ total: '200.00', difference: '100.00' });
    expect(tx.order.updateMany).not.toHaveBeenCalled();
    expect(stock.move).not.toHaveBeenCalled();
  });

  it('refuses a sale with returned items, and an edit that lost the race', async () => {
    await expect(
      make({ posRefundedAmount: D(10), status: 'COMPLETED' }).svc.editSale(4, 5, 7, [{ productId: 10, quantity: 1 }]),
    ).rejects.toThrow(/returned/);
    const m = make();
    m.tx.order.updateMany.mockResolvedValue({ count: 0 });
    await expect(m.svc.editSale(4, 5, 7, [{ productId: 10, quantity: 1 }])).rejects.toThrow(/just changed/);
    expect(m.salesPosting.postRefund).not.toHaveBeenCalled();
  });
});

// Sale: one Frozen Chicken, 1.25 kg sold at ৳375 (৳300/kg), plus 1 × Oil ৳50.
function makeWeighed(todayPrice = '352') {
  const order = {
    id: 6,
    storeId: 4,
    status: 'COMPLETED',
    deletedAt: null,
    updatedAt: new Date('2026-10-16T00:00:00Z'),
    subTotal: D(425),
    discountAmount: D(0),
    posManualDiscount: D(0),
    posVatDiscount: D(0),
    posRefundedAmount: D(0),
    taxAmount: D(0),
    totalAmount: D(425),
    tenderedAmount: D(425),
    payments: [{ provider: 'CASH', transactionRef: null }],
    items: [
      { id: 51, productId: 9, variantId: null, quantity: 1, unitPrice: D(375), weighedKg: new Prisma.Decimal('1.25'), restockedQuantity: 0, productNameSnapshot: 'Frozen Chicken' },
      { id: 52, productId: 10, variantId: null, quantity: 1, unitPrice: D(50), weighedKg: null, restockedQuantity: 0, productNameSnapshot: 'Oil' },
    ],
  };
  const tx = {
    order: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    orderItem: { update: jest.fn(), delete: jest.fn(), create: jest.fn() },
    payment: { updateMany: jest.fn() },
    orderStatusHistory: { create: jest.fn() },
  };
  const product = (id: number, name: string, soldByWeight = false) => ({
    id, sku: `S${id}`, slug: name, productType: 'PHYSICAL', vatRatePercent: null,
    soldByWeight, translations: [{ name }], variants: [],
  });
  const prisma = {
    client: {
      product: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([product(9, 'Frozen Chicken', true), product(10, 'Oil')])
          .mockResolvedValueOnce([{ id: 9 }, { id: 10 }]),
      },
      storePrice: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: (f: (t: typeof tx) => Promise<unknown>) => f(tx),
    },
  };
  const stock = { move: jest.fn() };
  const pricing = { priceLines: jest.fn().mockResolvedValue([{ unitPrice: todayPrice, perKgPrice: D(320) }]) };
  const svc = new PosSaleService(
    prisma as never, stock as never, { tenderAccountId: jest.fn().mockResolvedValue(11) } as never, pricing as never,
    { postPrepaidCapture: jest.fn(), postRefund: jest.fn() } as never,
    { getVat: jest.fn().mockResolvedValue({ enabled: false, ratePercent: 0, pricesIncludeVat: false, vatDiscount: false }) } as never,
    {} as never, {} as never,
  );
  jest.spyOn(svc, 'get').mockResolvedValue(order as never);
  return { svc, tx, stock, pricing };
}

describe('PosSaleService.editSale — sold by weight', () => {
  const oil = { productId: 10, quantity: 1 };

  it('re-weighing uses the stored per-kg rate, not price ÷ weight', async () => {
    const { svc, tx } = makeWeighed();
    // 1.225 kg at ৳300/kg rang up ৳368 (367.5 rounded); 368 / 1.225 = 300.41.
    (svc.get as jest.Mock).mockResolvedValueOnce({
      ...(await svc.get(4, 6)),
      items: [
        { id: 51, productId: 9, variantId: null, quantity: 1, unitPrice: D(368), weighedKg: new Prisma.Decimal('1.225'), pricePerKg: D(300), restockedQuantity: 0, productNameSnapshot: 'Frozen Chicken' },
        { id: 52, productId: 10, variantId: null, quantity: 1, unitPrice: D(50), weighedKg: null, pricePerKg: null, restockedQuantity: 0, productNameSnapshot: 'Oil' },
      ],
    });
    await svc.editSale(4, 6, 7, [
      { productId: 9, quantity: 1, lineId: 51, weighedKg: 1.5 },
      { productId: 10, quantity: 1 },
    ]);
    expect(tx.orderItem.update.mock.calls[0][0].data.unitPrice).toEqual(D(450));
  });

  it('re-weighing keeps the sale-time rate and does not move stock', async () => {
    const { svc, tx, stock } = makeWeighed();
    const r = await svc.editSale(4, 6, 7, [
      { productId: 9, quantity: 1, lineId: 51, weighedKg: 1.5 },
      oil,
    ]);
    expect(r.total).toBe('500.00'); // 300/kg × 1.5 = 450, + 50
    expect(tx.orderItem.update).toHaveBeenCalledWith({
      where: { id: 51 },
      data: { quantity: 1, weighedKg: 1.5, unitPrice: D(450) },
    });
    expect(stock.move).not.toHaveBeenCalled();
  });

  it('a second chicken is a new line at today’s price and takes one off stock', async () => {
    const { svc, tx, stock, pricing } = makeWeighed('352');
    await svc.editSale(4, 6, 7, [
      { productId: 9, quantity: 1, lineId: 51, weighedKg: 1.25 },
      { productId: 9, quantity: 1, weighedKg: 1.1 },
      oil,
    ]);
    expect(pricing.priceLines).toHaveBeenCalledWith(
      [expect.objectContaining({ productId: 9, weighedKg: 1.1 })],
      4,
    );
    expect(tx.orderItem.create.mock.calls[0][0].data).toMatchObject({
      productId: 9, quantity: 1, weighedKg: 1.1, unitPrice: D(352), pricePerKg: D(320),
    });
    expect(tx.orderItem.update).not.toHaveBeenCalled();
    expect(stock.move.mock.calls.map((c) => [c[1].productId, c[1].type, c[1].qty])).toEqual([[9, 'SALE', -1]]);
  });

  it('dropping the weighed line returns one piece', async () => {
    const { svc, tx, stock } = makeWeighed();
    await svc.editSale(4, 6, 7, [oil]);
    expect(tx.orderItem.delete).toHaveBeenCalledWith({ where: { id: 51 } });
    expect(stock.move.mock.calls.map((c) => [c[1].productId, c[1].type, c[1].qty])).toEqual([[9, 'RETURN', 1]]);
  });

  it('a new weighed line needs its weight', async () => {
    const { svc } = makeWeighed();
    await expect(
      svc.editSale(4, 6, 7, [{ productId: 9, quantity: 1 }, oil]),
    ).rejects.toThrow(/enter its weight/);
  });

  it('refuses the same weighed line twice (would make it quantity 2)', async () => {
    const { svc } = makeWeighed();
    await expect(
      svc.editSale(4, 6, 7, [
        { productId: 9, quantity: 1, lineId: 51, weighedKg: 1.25 },
        { productId: 9, quantity: 1, lineId: 51, weighedKg: 1.25 },
        oil,
      ]),
    ).rejects.toThrow(/more than once/);
  });

  it('refuses a line id that belongs to another product', async () => {
    const { svc } = makeWeighed();
    await expect(
      svc.editSale(4, 6, 7, [
        { productId: 10, quantity: 1, lineId: 51, weighedKg: 1.25 },
        oil,
      ]),
    ).rejects.toThrow(/not on this sale/);
  });

  it('an old by-the-piece line of a now-weighed product can stay as it is', async () => {
    const { svc, tx } = makeWeighed();
    (svc.get as jest.Mock).mockResolvedValueOnce({
      ...(await svc.get(4, 6)),
      items: [
        { id: 61, productId: 9, variantId: null, quantity: 2, unitPrice: D(300), weighedKg: null, pricePerKg: null, restockedQuantity: 0, productNameSnapshot: 'Frozen Chicken' },
        { id: 52, productId: 10, variantId: null, quantity: 1, unitPrice: D(50), weighedKg: null, pricePerKg: null, restockedQuantity: 0, productNameSnapshot: 'Oil' },
      ],
    });
    await svc.editSale(4, 6, 7, [{ productId: 9, quantity: 2 }, { productId: 10, quantity: 2 }]);
    expect(tx.orderItem.update).toHaveBeenCalledWith({ where: { id: 52 }, data: { quantity: 2 } });
  });
});
