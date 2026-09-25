import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { PosSaleService, posTotals } from './pos-sale.service';

const D = (n: number | string) => new Prisma.Decimal(n);
const VAT15 = { enabled: true, ratePercent: 15, pricesIncludeVat: false };

describe('posTotals', () => {
  const lines = [
    { unitPrice: D(40), qty: 2, vatRate: D(15) }, // 80
    { unitPrice: D(30), qty: 1, vatRate: D(15) }, // 30
    { unitPrice: D(120), qty: 1, vatRate: D(0) }, // 120, exempt (e.g. milk)
  ];

  it('adds VAT on top, only on VAT-able lines', () => {
    const t = posTotals(lines, D(0), true);
    expect(t.subTotal.toFixed(2)).toBe('230.00');
    expect(t.vat.toFixed(2)).toBe('16.50'); // 15% of 110
    expect(t.total.toFixed(2)).toBe('246.50');
  });

  it('VAT-inclusive mode extracts VAT and leaves the total alone', () => {
    const t = posTotals(lines, D(0), false);
    expect(t.total.toFixed(2)).toBe('230.00');
    expect(t.vat.toFixed(2)).toBe('14.35'); // 110 * 15/115
  });

  it('spreads a discount across lines before VAT', () => {
    const t = posTotals(lines, D(23), true); // 10% off everything
    expect(t.vat.toFixed(2)).toBe('14.85');
    expect(t.total.toFixed(2)).toBe('221.85');
  });

  it('never goes below zero with a large discount', () => {
    const t = posTotals(lines, D(1000), true);
    expect(t.total.toFixed(2)).toBe('0.00');
    expect(t.vat.toFixed(2)).toBe('0.00');
  });

  it('matches the mockup: 305 subtotal at 15% → 350.75', () => {
    expect(
      posTotals(
        [{ unitPrice: D(305), qty: 1, vatRate: D(15) }],
        D(0),
        true,
      ).total.toFixed(2),
    ).toBe('350.75');
  });
});

describe('PosSaleService.create', () => {
  function setup(opts: { moveFails?: boolean; inactive?: boolean } = {}) {
    const tx = {
      order: {
        create: jest.fn().mockResolvedValue({ id: 99, orderNumber: 'ORD-1' }),
      },
      payment: { create: jest.fn() },
      posHeldSale: { deleteMany: jest.fn() },
    };
    const prisma = {
      client: {
        product: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 10,
              slug: 'coke',
              sku: 'C',
              productType: 'PHYSICAL',
              vatRatePercent: null,
              translations: [{ name: 'Coke' }],
              variants: [],
            },
          ]),
        },
        $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
        store: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            id: 4,
            name: 'S',
            isActive: opts.inactive ? false : true,
          }),
        },
      },
    };
    const stock = {
      move: opts.moveFails
        ? jest.fn().mockRejectedValue(new BadRequestException('Not enough'))
        : jest.fn(),
    };
    const stores = { tenderAccountId: jest.fn().mockResolvedValue(33) };
    const pricing = {
      priceLines: jest.fn().mockResolvedValue([{ unitPrice: D(40) }]),
      price: jest.fn(),
    };
    const salesPosting = { postPrepaidCapture: jest.fn() };
    const settings = { getVat: jest.fn().mockResolvedValue(VAT15) };
    const svc = new PosSaleService(
      prisma as never,
      stock as never,
      stores as never,
      pricing as never,
      salesPosting as never,
      settings as never,
      {} as never,
      {} as never,
    );
    return { svc, tx, stock, stores, salesPosting, pricing };
  }

  const dto = {
    items: [{ productId: 10, quantity: 2 }],
    tender: 'CASH' as const,
    tenderedAmount: 100,
  };

  it('creates a completed POS order at the store, moves stock, captures payment, posts to the store till', async () => {
    const { svc, tx, stock, stores, salesPosting } = setup();
    const out = await svc.create(4, dto, 7);

    expect(tx.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        channel: 'POS',
        status: 'COMPLETED',
        storeId: 4,
        totalAmount: D('92.00'),
      }),
    });
    expect(stock.move).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        storeId: 4,
        productId: 10,
        type: 'SALE',
        qty: -2,
        orderId: 99,
      }),
    );
    expect(tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ provider: 'CASH', status: 'CAPTURED' }),
    });
    expect(stores.tenderAccountId).toHaveBeenCalledWith(4, 'CASH');
    expect(salesPosting.postPrepaidCapture).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 99, accountId: 33 }),
    );
    expect(out).toEqual({
      orderId: 99,
      orderNumber: 'ORD-1',
      total: '92.00',
      change: '8.00',
    });
  });

  it('posts nothing to Accounts when the stock move fails', async () => {
    const { svc, salesPosting } = setup({ moveFails: true });
    await expect(svc.create(4, dto, 7)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(salesPosting.postPrepaidCapture).not.toHaveBeenCalled();
  });

  it('ignores a free-typed discount (not a cashier power; coupons only)', async () => {
    const { svc, tx } = setup();
    await svc.create(4, { ...dto, discountAmount: 80 } as never, 7);
    expect(tx.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ totalAmount: D('92.00') }),
    });
  });

  it('only sells what the catalog shows (not deleted, draft or digital)', async () => {
    const { svc } = setup();
    const findMany = (
      svc as unknown as {
        prisma: { client: { product: { findMany: jest.Mock } } };
      }
    ).prisma.client.product.findMany;
    await svc.create(4, dto, 7);
    expect(findMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({
        deletedAt: null,
        status: { in: ['PUBLISHED', 'ADMIN_ONLY'] },
        productType: { not: 'DIGITAL' },
      }),
    );
  });

  it('refuses an item that prices at zero (no price set)', async () => {
    const { svc, pricing } = setup();
    pricing.priceLines.mockResolvedValue([{ unitPrice: D(0) }]);
    await expect(svc.create(4, dto, 7)).rejects.toThrow(/no price/);
  });

  it('stores the cash handed over so the receipt can show change', async () => {
    const { svc, tx } = setup();
    await svc.create(4, dto, 7);
    expect(tx.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenderedAmount: D(100) }),
    });
    await svc.create(
      4,
      { ...dto, tender: 'CARD', tenderedAmount: undefined },
      7,
    );
    expect(tx.order.create.mock.calls[1][0].data.tenderedAmount).toBeNull();
  });

  it('an inactive store cannot sell', async () => {
    const { svc, tx } = setup({ inactive: true });
    await expect(svc.create(4, dto, 7)).rejects.toThrow(/inactive/i);
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('refuses cash less than the total', async () => {
    const { svc } = setup();
    await expect(
      svc.create(4, { ...dto, tenderedAmount: 50 }, 7),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a product that is not sold at this store', async () => {
    const { svc } = setup();
    await expect(
      svc.create(4, { ...dto, items: [{ productId: 11, quantity: 1 }] }, 7),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('PosSaleService customers', () => {
  function svcWith(existing: unknown) {
    const create = jest.fn().mockResolvedValue({
      id: 5,
      firstName: 'Rahim',
      lastName: null,
      phone: '01711111111',
    });
    const prisma = {
      client: {
        customer: { findFirst: jest.fn().mockResolvedValue(existing), create },
      },
    };
    const svc = new PosSaleService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { svc, create };
  }

  it('quick-add returns the existing customer for a known phone instead of failing', async () => {
    const { svc, create } = svcWith({
      id: 3,
      firstName: 'Karim',
      lastName: null,
      phone: '01711111111',
    });
    expect(await svc.quickCustomer('+8801711111111', 'Someone')).toEqual({
      id: 3,
      name: 'Karim',
      phone: '01711111111',
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('quick-add creates a new customer', async () => {
    const { svc, create } = svcWith(null);
    expect(await svc.quickCustomer('01711111111', 'Rahim')).toEqual({
      id: 5,
      name: 'Rahim',
      phone: '01711111111',
    });
    expect(create).toHaveBeenCalledWith({
      data: { phone: '01711111111', firstName: 'Rahim' },
    });
  });
});

describe('PosSaleService.quote', () => {
  it('returns the same totals create() charges, with the VAT rate used', async () => {
    const prisma = {
      client: {
        product: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 10,
              slug: 'coke',
              sku: 'C',
              productType: 'PHYSICAL',
              vatRatePercent: null,
              translations: [],
              variants: [],
            },
          ]),
        },
      },
    };
    const pricing = {
      priceLines: jest.fn().mockResolvedValue([{ unitPrice: D(40) }]),
      price: jest.fn(),
    };
    const settings = { getVat: jest.fn().mockResolvedValue(VAT15) };
    const svc = new PosSaleService(
      prisma as never,
      {} as never,
      {} as never,
      pricing as never,
      {} as never,
      settings as never,
      {} as never,
      {} as never,
    );
    expect(
      await svc.quote(4, { items: [{ productId: 10, quantity: 2 }] }),
    ).toEqual({
      subTotal: '80.00',
      discount: '0.00',
      vat: '12.00',
      total: '92.00',
      vatOnTop: true,
      vatRatePercent: 15,
    });
  });
});

describe('PosSaleService VAT follows POS Settings', () => {
  function quoteWith(vat: object, productVat: number | null = null) {
    const prisma = {
      client: {
        product: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 10,
              slug: 'x',
              sku: 'X',
              productType: 'PHYSICAL',
              vatRatePercent: productVat === null ? null : D(productVat),
              translations: [],
              variants: [],
            },
          ]),
        },
      },
    };
    const pricing = {
      priceLines: jest.fn().mockResolvedValue([{ unitPrice: D(100) }]),
      price: jest.fn(),
    };
    const settings = { getVat: jest.fn().mockResolvedValue(vat) };
    const svc = new PosSaleService(
      prisma as never,
      {} as never,
      {} as never,
      pricing as never,
      {} as never,
      settings as never,
      {} as never,
      {} as never,
    );
    return svc.quote(1, { items: [{ productId: 10, quantity: 1 }] });
  }

  it('VAT off: no VAT, total = shelf price', async () => {
    expect(
      await quoteWith({
        enabled: false,
        ratePercent: 15,
        pricesIncludeVat: false,
      }),
    ).toEqual(
      expect.objectContaining({
        vat: '0.00',
        total: '100.00',
        vatRatePercent: 0,
      }),
    );
  });

  it('prices include VAT: total = shelf price, VAT extracted', async () => {
    expect(
      await quoteWith({
        enabled: true,
        ratePercent: 15,
        pricesIncludeVat: true,
      }),
    ).toEqual(
      expect.objectContaining({
        vat: '13.04',
        total: '100.00',
        vatOnTop: false,
      }),
    );
  });

  it('custom rate is used', async () => {
    expect(
      await quoteWith({
        enabled: true,
        ratePercent: 5,
        pricesIncludeVat: false,
      }),
    ).toEqual(
      expect.objectContaining({
        vat: '5.00',
        total: '105.00',
        vatRatePercent: 5,
      }),
    );
  });

  it('a VAT-exempt product stays exempt', async () => {
    expect(await quoteWith(VAT15, 0)).toEqual(
      expect.objectContaining({ vat: '0.00', total: '100.00' }),
    );
  });
});

describe('PosSaleService.get — receipt data', () => {
  it("adds each line's variant label", async () => {
    const order = {
      id: 1,
      status: 'COMPLETED',
      items: [
        {
          id: 1,
          productNameSnapshot: 'Honey',
          variant: {
            attributeValues: [
              { attributeValue: { translations: [{ value: '1KG' }] } },
            ],
          },
        },
        { id: 2, productNameSnapshot: 'Oil', variant: null },
      ],
    };
    const prisma = {
      client: { order: { findFirst: jest.fn().mockResolvedValue(order) } },
    };
    const svc = new PosSaleService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const out = await svc.get(null, 1);
    expect(out.items.map((i) => i.variantLabel)).toEqual(['1KG', null]);
  });
});

describe('PosSaleService.returnSale', () => {
  function setupReturn(claimed: number) {
    const order = {
      id: 5,
      status: 'COMPLETED',
      storeId: 4,
      totalAmount: D(92),
      items: [{ productId: 10, variantId: null, quantity: 2 }],
    };
    const tx = {
      order: { updateMany: jest.fn().mockResolvedValue({ count: claimed }) },
      orderStatusHistory: { create: jest.fn() },
    };
    const prisma = {
      client: {
        order: {
          findFirst: jest.fn().mockResolvedValue({
            ...order,
            items: order.items.map((i) => ({ ...i, variant: null })),
          }),
        },
        $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
      },
    };
    const stock = { move: jest.fn() };
    const payments = { refund: jest.fn() };
    const events = { emit: jest.fn() };
    const svc = new PosSaleService(
      prisma as never,
      stock as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      payments as never,
      events as never,
    );
    return { svc, tx, stock, payments, events };
  }

  it('claims the order first (COMPLETED → RETURNED + returnedAt), restocks the store, refunds once', async () => {
    const { svc, tx, stock, payments, events } = setupReturn(1);
    await svc.returnSale(4, 5, 7, 'damaged');
    // customer stats / profit / SMS listeners stay in sync
    expect(events.emit).toHaveBeenCalledWith('order.status_changed', {
      orderId: 5,
      from: 'COMPLETED',
      to: 'RETURNED',
    });
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: 5, status: 'COMPLETED' },
      data: { status: 'RETURNED', returnedAt: expect.any(Date) },
    });
    expect(stock.move).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        storeId: 4,
        productId: 10,
        type: 'RETURN',
        qty: 2,
        orderId: 5,
      }),
    );
    expect(payments.refund).toHaveBeenCalledTimes(1);
  });

  it('a second, concurrent return loses the claim: no restock, no refund', async () => {
    const { svc, stock, payments } = setupReturn(0);
    await expect(svc.returnSale(4, 5, 7)).rejects.toThrow(/already/i);
    expect(stock.move).not.toHaveBeenCalled();
    expect(payments.refund).not.toHaveBeenCalled();
  });
});

describe('PosSaleService — till context and quick customer', () => {
  function setup2() {
    const tx = {
      order: {
        create: jest.fn().mockResolvedValue({ id: 99, orderNumber: 'ORD-1' }),
      },
      payment: { create: jest.fn() },
      posHeldSale: { deleteMany: jest.fn() },
    };
    const prisma = {
      client: {
        product: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 10,
              slug: 'c',
              sku: 'C',
              productType: 'PHYSICAL',
              vatRatePercent: null,
              translations: [{ name: 'C' }],
              variants: [],
            },
          ]),
        },
        customer: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 55,
            firstName: null,
            lastName: null,
            phone: '01712345678',
          }),
        },
        store: {
          findUniqueOrThrow: jest
            .fn()
            .mockResolvedValue({ id: 4, isActive: true }),
        },
        $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
      },
    };
    const pricing = {
      priceLines: jest.fn().mockResolvedValue([{ unitPrice: D(40) }]),
      price: jest.fn().mockResolvedValue({
        couponError: null,
        discounts: [{ source: 'COUPON', amount: D(4) }],
      }),
    };
    const settings = { getVat: jest.fn().mockResolvedValue(VAT15) };
    const svc = new PosSaleService(
      prisma as never,
      { move: jest.fn() } as never,
      { tenderAccountId: jest.fn() } as never,
      pricing as never,
      { postPrepaidCapture: jest.fn() } as never,
      settings as never,
      {} as never,
      { emit: jest.fn() } as never,
    );
    return { svc, tx, prisma, pricing };
  }

  it('coupons are priced in the till context of this store (POS-only / store-limited codes)', async () => {
    const { svc, pricing } = setup2();
    await svc.quote(4, {
      items: [{ productId: 10, quantity: 1 }],
      couponCode: 'STORE10',
    });
    expect(pricing.price).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ couponCode: 'STORE10', pos: { storeId: 4 } }),
    );
  });

  it('a typed phone with no customer picked creates the customer and attaches the sale', async () => {
    const { svc, tx, prisma } = setup2();
    await svc.create(
      4,
      {
        items: [{ productId: 10, quantity: 1 }],
        tender: 'CARD',
        customerPhone: '01712345678',
      } as never,
      7,
    );
    expect(prisma.client.customer.create).toHaveBeenCalledWith({
      data: { phone: '01712345678' },
    });
    expect(tx.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ customerId: 55 }),
    });
  });

  it('a picked customer wins over a typed phone', async () => {
    const { svc, tx, prisma } = setup2();
    await svc.create(
      4,
      {
        items: [{ productId: 10, quantity: 1 }],
        tender: 'CARD',
        customerId: 8,
        customerPhone: '01712345678',
      } as never,
      7,
    );
    expect(prisma.client.customer.create).not.toHaveBeenCalled();
    expect(tx.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ customerId: 8 }),
    });
  });
});
