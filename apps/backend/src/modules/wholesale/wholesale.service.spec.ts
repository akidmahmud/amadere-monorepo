import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { WholesaleService } from './wholesale.service';
import { LedgerService } from '../net-profit/accounts/ledger/ledger.service';
import { DuesService } from '../net-profit/accounts/dues/dues.service';
import { AccountsSettingsService } from '../net-profit/accounts/accounts-settings.service';
import { PrismaService } from '../../common/prisma/prisma.service';

const D = (v: string | number) => new Prisma.Decimal(v);

// Two products so a multi-line order exercises the subtotal, and one digital
// so the "never move stock we never reserved" rule is actually covered.
const SATTU = {
  id: 1,
  sku: 'AM-JS-001',
  slug: 'jober-sattu',
  productType: 'PHYSICAL',
  translations: [{ name: 'Jober Sattu' }],
};
const EBOOK = {
  id: 2,
  sku: 'AM-EB-002',
  slug: 'recipe-ebook',
  productType: 'DIGITAL',
  translations: [{ name: 'Recipe eBook' }],
};

const BUYER = {
  id: 7,
  name: 'Rahman Grocery',
  phone: '01711111111',
  address: 'Mirpur',
  roles: ['WHOLESALE', 'CUSTOMER'],
  creditLimit: D('100000'),
  creditDays: 15,
  note: null,
  isActive: true,
  deletedAt: null,
};

describe('WholesaleService', () => {
  let service: WholesaleService;
  let prisma: {
    client: Record<string, Record<string, jest.Mock>> & {
      $transaction: jest.Mock;
    };
  };
  let ledger: {
    post: jest.Mock;
    paidForDues: jest.Mock;
    partyPositions: jest.Mock;
    assertPeriodOpen: jest.Mock;
  };
  let dues: { void: jest.Mock; recordPayment: jest.Mock };
  let settings: { getPostingSettings: jest.Mock };

  const tx = {
    wholesaleOrder: {
      create: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    },
    // deleteMany/update are only exercised by the edit path, but they are
    // declared here rather than bolted on in a beforeEach so the mock's shape
    // stays a single typed object.
    wholesaleOrderItem: { deleteMany: jest.fn() },
    due: {
      create: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    },
    product: { update: jest.fn() },
    productVariant: { update: jest.fn() },
  };

  const savedOrder = {
    id: 30,
    orderNumber: 'WS-2608-0001',
    partyId: BUYER.id,
    status: 'PENDING' as const,
    courier: 'SUNDARBAN' as const,
    consignmentId: 'SB-778899',
    subtotal: D('900.00'),
    deliveryCharge: D('60.00'),
    discount: D('100.00'),
    total: D('860.00'),
    note: null,
    placedAt: new Date('2026-08-31'),
    cancelledAt: null,
    party: { id: BUYER.id, name: BUYER.name, phone: BUYER.phone },
    items: [
      {
        id: 1,
        productId: 1,
        variantId: null,
        nameSnapshot: 'Jober Sattu',
        skuSnapshot: 'AM-JS-001',
        unitPrice: D('450.00'),
        quantity: 2,
        discount: D('0.00'),
        lineTotal: D('900.00'),
        // Shaped like ORDER_INCLUDE: the mapper reads the line's thumbnail
        // off the product, and updateOrder reads productType off the same
        // relation.
        product: { productType: 'PHYSICAL', media: [] },
      },
    ],
    dues: [
      {
        id: 90,
        docNo: 'AR-2608-0004',
        voidedAt: null,
        kind: 'RECEIVABLE' as const,
      },
    ],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    tx.wholesaleOrder.create.mockResolvedValue(savedOrder);
    tx.wholesaleOrder.findFirst.mockResolvedValue(null);
    tx.due.create.mockResolvedValue({ id: 90 });
    tx.due.findFirst.mockResolvedValue(null);

    prisma = {
      client: {
        party: {
          findFirst: jest.fn().mockResolvedValue(BUYER),
          findUnique: jest.fn(),
          findMany: jest.fn(),
          count: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        product: { findMany: jest.fn().mockResolvedValue([SATTU, EBOOK]) },
        productVariant: { findMany: jest.fn().mockResolvedValue([]) },
        cashAccount: { findMany: jest.fn().mockResolvedValue([]) },
        wholesaleOrderItem: { findMany: jest.fn().mockResolvedValue([]) },
        wholesaleChannel: { findUnique: jest.fn().mockResolvedValue(null) },
        wholesaleOrder: {
          findUnique: jest.fn().mockResolvedValue(savedOrder),
          findMany: jest.fn(),
          count: jest.fn(),
          groupBy: jest.fn().mockResolvedValue([]),
        },
        $transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
      },
    } as never;

    ledger = {
      post: jest.fn(),
      paidForDues: jest.fn().mockResolvedValue(new Map([[90, D('800.00')]])),
      partyPositions: jest.fn().mockResolvedValue(new Map()),
      assertPeriodOpen: jest.fn(),
    };
    dues = { void: jest.fn(), recordPayment: jest.fn() };
    settings = {
      getPostingSettings: jest
        .fn()
        .mockResolvedValue({ defaultCashAccountId: 4 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WholesaleService,
        { provide: PrismaService, useValue: prisma },
        { provide: LedgerService, useValue: ledger },
        { provide: DuesService, useValue: dues },
        { provide: AccountsSettingsService, useValue: settings },
      ],
    }).compile();

    service = module.get(WholesaleService);
  });

  const order = (over: Record<string, unknown> = {}) => ({
    partyId: BUYER.id,
    courier: 'SUNDARBAN' as const,
    consignmentId: 'SB-778899',
    items: [{ productId: 1, unitPrice: '450', quantity: 2 }],
    deliveryCharge: '60',
    discount: '100',
    paidAmount: '800',
    placedAt: '2026-08-31',
    ...over,
  });

  it('filters the wholesale order register by placed-at time', async () => {
    prisma.client.wholesaleOrder.findMany.mockResolvedValue([]);
    prisma.client.wholesaleOrder.count.mockResolvedValue(0);

    await service.listOrders({
      from: '2026-09-18T00:00:00.000Z',
      to: '2026-09-18T10:30:00.000Z',
    });

    const expectedRange = {
      gte: new Date('2026-09-18T00:00:00.000Z'),
      lte: new Date('2026-09-18T10:30:00.000Z'),
    };
    expect(prisma.client.wholesaleOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ placedAt: expectedRange }),
      }),
    );
    expect(prisma.client.wholesaleOrder.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ placedAt: expectedRange }),
    });
  });

  it('applies the placed-at range to wholesale dashboard order statistics', async () => {
    prisma.client.party.count.mockResolvedValue(0);
    prisma.client.party.findMany.mockResolvedValue([]);

    await service.stats({
      from: '2026-09-18T00:00:00.000Z',
      to: '2026-09-18T10:30:00.000Z',
    });

    for (const call of prisma.client.wholesaleOrder.groupBy.mock.calls) {
      expect(call[0].where).toEqual(
        expect.objectContaining({
          placedAt: {
            gte: new Date('2026-09-18T00:00:00.000Z'),
            lte: new Date('2026-09-18T10:30:00.000Z'),
          },
        }),
      );
    }
  });

  it('rejects a wholesale order range whose end precedes its start', async () => {
    await expect(
      service.listOrders({
        from: '2026-09-19T00:00:00.000Z',
        to: '2026-09-18T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('prices the order from the wholesale rate on the line, not the retail price', async () => {
    await service.createOrder(order(), 1);
    const data = tx.wholesaleOrder.create.mock.calls[0][0].data;
    expect(data.subtotal.toFixed(2)).toBe('900.00');
    expect(data.total.toFixed(2)).toBe('860.00'); // 900 + 60 − 100
    expect(data.items.create[0].unitPrice.toFixed(2)).toBe('450.00');
  });

  it('raises one WHOLESALE_INVOICE receivable against the buyer for the full bill', async () => {
    await service.createOrder(order(), 1);
    const due = tx.due.create.mock.calls[0][0].data;
    expect(due.kind).toBe('RECEIVABLE');
    expect(due.source).toBe('WHOLESALE_INVOICE');
    expect(due.partyId).toBe(BUYER.id);
    expect(due.amount.toFixed(2)).toBe('860.00');
    expect(due.wholesaleOrderId).toBe(savedOrder.id);
    // 15 credit days from 31 Aug
    expect(due.dueDate?.toISOString().slice(0, 10)).toBe('2026-09-15');
  });

  it('posts only what was actually paid, leaving the rest outstanding on the due', async () => {
    await service.createOrder(order(), 1);
    expect(ledger.post).toHaveBeenCalledTimes(1);
    const [entry] = ledger.post.mock.calls[0];
    expect(entry.direction).toBe('IN');
    expect(entry.source).toBe('RECEIVABLE_RECEIPT');
    expect(entry.amount.toFixed(2)).toBe('800.00');
    expect(entry.dueId).toBe(90);
    expect(entry.accountId).toBe(4);
  });

  it('books no ledger entry at all for a fully unpaid order', async () => {
    await service.createOrder(order({ paidAmount: '0' }), 1);
    expect(tx.due.create).toHaveBeenCalledTimes(1);
    expect(ledger.post).not.toHaveBeenCalled();
  });

  it('decrements stock for a physical line', async () => {
    await service.createOrder(order(), 1);
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { stock: { decrement: 2 } },
    });
  });

  it('moves no stock for a digital line, which never had any', async () => {
    await service.createOrder(
      order({ items: [{ productId: 2, unitPrice: '450', quantity: 2 }] }),
      1,
    );
    expect(tx.product.update).not.toHaveBeenCalled();
  });

  // The wholesale/cash-sale split. Each of these decides something real
  // downstream -- whether a delivery snapshot means anything, whether a
  // payment can ever be reconciled, whether a till can be counted -- so none
  // of them is left to the form to remember.
  describe('the wholesale / channel split', () => {
    const CASH_SALE = {
      id: 1,
      name: 'Cash Sale',
      hasDelivery: false,
      isActive: true,
      fields: [
        {
          key: 'gp_number',
          label: 'GP Number',
          type: 'text',
          required: true,
          showInTable: true,
        },
      ],
    };
    const DARAZ = {
      id: 2,
      name: 'Daraz',
      hasDelivery: true,
      isActive: true,
      fields: [
        {
          key: 'order_ref',
          label: 'Order ID',
          type: 'text',
          required: true,
          showInTable: true,
        },
      ],
    };
    const viaChannel = (over = {}) =>
      order({
        type: 'CHANNEL' as const,
        channelId: 1,
        courier: undefined,
        channelData: { gp_number: 'GP-1' },
        ...over,
      });

    it('accepts a Cash Sale channel order with its GP number and no courier', async () => {
      prisma.client.wholesaleChannel.findUnique.mockResolvedValue(CASH_SALE);
      await service.createOrder(viaChannel({ deliveryCharge: undefined }), 1);
      const data = tx.wholesaleOrder.create.mock.calls[0][0].data;
      expect(data.type).toBe('CHANNEL');
      expect(data.channelId).toBe(1);
      expect(data.courier).toBeNull();
      expect(data.channel).toBeNull();
      expect(data.channelData).toEqual({ gp_number: 'GP-1' });
      expect(data.channelSearch).toBe('GP-1');
    });

    it('refuses a wholesale order with no courier', async () => {
      await expect(
        service.createOrder(order({ courier: undefined }), 1),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a courier or delivery charge on a channel without delivery', async () => {
      prisma.client.wholesaleChannel.findUnique.mockResolvedValue(CASH_SALE);
      await expect(
        service.createOrder(
          viaChannel({
            courier: 'SUNDARBAN' as const,
            deliveryCharge: undefined,
          }),
          1,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.createOrder(viaChannel({ deliveryCharge: '60' }), 1),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("refuses a channel order missing one of the channel's required fields", async () => {
      prisma.client.wholesaleChannel.findUnique.mockResolvedValue(CASH_SALE);
      await expect(
        service.createOrder(
          viaChannel({
            deliveryCharge: undefined,
            channelData: { gp_number: '  ' },
          }),
          1,
        ),
      ).rejects.toThrow('GP Number is required');
    });

    it('needs a courier on a channel with delivery, and an active channel at all', async () => {
      prisma.client.wholesaleChannel.findUnique.mockResolvedValue(DARAZ);
      await expect(
        service.createOrder(
          viaChannel({ channelId: 2, channelData: { order_ref: 'DZ-1' } }),
          1,
        ),
      ).rejects.toThrow('needs a courier');
      await service.createOrder(
        viaChannel({
          channelId: 2,
          courier: 'STEADFAST' as const,
          channelData: { order_ref: 'DZ-1' },
        }),
        1,
      );
      expect(tx.wholesaleOrder.create.mock.calls[0][0].data.courier).toBe(
        'STEADFAST',
      );

      prisma.client.wholesaleChannel.findUnique.mockResolvedValue({
        ...DARAZ,
        isActive: false,
      });
      await expect(
        service.createOrder(
          viaChannel({
            channelId: 2,
            courier: 'STEADFAST' as const,
            channelData: { order_ref: 'x' },
          }),
          1,
        ),
      ).rejects.toThrow('deactivated');
      await expect(
        service.createOrder(viaChannel({ channelId: undefined }), 1),
      ).rejects.toThrow('Choose a channel');
    });

    it('refuses a non-cash payment with no transaction id', async () => {
      await expect(
        service.createOrder(order({ paymentMethod: 'BKASH' as const }), 1),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a line discount bigger than the line it is taken off', async () => {
      await expect(
        service.createOrder(
          order({
            items: [
              { productId: 1, unitPrice: '450', quantity: 2, discount: '5000' },
            ],
          }),
          1,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('derives payment status from what was collected, not from the client', async () => {
      await service.createOrder(order({ paidAmount: '860' }), 1);
      expect(tx.wholesaleOrder.create.mock.calls[0][0].data.paymentStatus).toBe(
        'PAID',
      );
      tx.wholesaleOrder.create.mockClear();
      await service.createOrder(order({ paidAmount: '0' }), 1);
      expect(tx.wholesaleOrder.create.mock.calls[0][0].data.paymentStatus).toBe(
        'UNPAID',
      );
      tx.wholesaleOrder.create.mockClear();
      await service.createOrder(order({ paidAmount: '100' }), 1);
      expect(tx.wholesaleOrder.create.mock.calls[0][0].data.paymentStatus).toBe(
        'PARTIALLY_PAID',
      );
    });
  });

  it('refuses a payment larger than the bill', async () => {
    await expect(
      service.createOrder(order({ paidAmount: '5000' }), 1),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a discount that would make the order worth less than nothing', async () => {
    await expect(
      service.createOrder(order({ discount: '5000' }), 1),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails the whole order rather than losing cash with nowhere to post it', async () => {
    settings.getPostingSettings.mockResolvedValue({
      defaultCashAccountId: null,
    });
    await expect(service.createOrder(order(), 1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    // The point of resolving the account first: nothing was written.
    expect(prisma.client.$transaction).not.toHaveBeenCalled();
  });

  it('still saves an unpaid order when no cash account is configured', async () => {
    settings.getPostingSettings.mockResolvedValue({
      defaultCashAccountId: null,
    });
    await expect(
      service.createOrder(order({ paidAmount: '0' }), 1),
    ).resolves.toBeDefined();
  });

  it('never writes to the retail order or customer tables', async () => {
    await service.createOrder(order(), 1);
    expect(prisma.client.order).toBeUndefined();
    expect(prisma.client.customer).toBeUndefined();
  });

  it('cancelling restocks the goods and voids the invoice', async () => {
    ledger.paidForDues.mockResolvedValue(new Map([[90, D('0')]]));
    await service.cancelOrder(savedOrder.id, 1);
    expect(tx.wholesaleOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CANCELLED' }),
      }),
    );
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { stock: { increment: 2 } },
    });
    expect(dues.void).toHaveBeenCalledWith(90, 1);
  });

  it('refuses to cancel once money has been collected', async () => {
    ledger.paidForDues.mockResolvedValue(new Map([[90, D('800.00')]]));
    await expect(service.cancelOrder(savedOrder.id, 1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(dues.void).not.toHaveBeenCalled();
  });

  it('restores a cancelled order by taking stock again and reopening its original invoice', async () => {
    const cancelled = {
      ...savedOrder,
      status: 'CANCELLED' as const,
      cancelledAt: new Date('2026-09-01'),
      dues: [{ ...savedOrder.dues[0], voidedAt: new Date('2026-09-01') }],
    };
    prisma.client.wholesaleOrder.findUnique
      .mockResolvedValueOnce(cancelled)
      .mockResolvedValueOnce(savedOrder);

    await service.restoreOrder(savedOrder.id);

    expect(ledger.assertPeriodOpen).toHaveBeenCalledWith(savedOrder.placedAt);
    expect(tx.wholesaleOrder.update).toHaveBeenCalledWith({
      where: { id: savedOrder.id },
      data: { status: 'PENDING', cancelledAt: null },
    });
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { stock: { decrement: 2 } },
    });
    expect(tx.due.update).toHaveBeenCalledWith({
      where: { id: 90 },
      data: { voidedAt: null },
    });
  });

  it('refuses to restore an order until its customer is restored and active', async () => {
    prisma.client.wholesaleOrder.findUnique.mockResolvedValue({
      ...savedOrder,
      status: 'CANCELLED',
      cancelledAt: new Date(),
      dues: [{ ...savedOrder.dues[0], voidedAt: new Date() }],
    });
    prisma.client.party.findFirst.mockResolvedValue(null);

    await expect(service.restoreOrder(savedOrder.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.client.$transaction).not.toHaveBeenCalled();
  });

  it('lists deleted wholesale customers separately from the live dashboard', async () => {
    prisma.client.party.findMany.mockResolvedValue([]);
    prisma.client.party.count.mockResolvedValue(0);

    await service.listDeletedCustomers({ page: 1, pageSize: 20 });

    expect(prisma.client.party.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: { not: null } }),
      }),
    );
  });

  it('restores a deleted wholesale customer as an active buyer', async () => {
    const deleted = {
      ...BUYER,
      isActive: false,
      deletedAt: new Date('2026-09-01'),
      assignedAdmin: null,
    };
    const restored = { ...deleted, isActive: true, deletedAt: null };
    prisma.client.party.findUnique.mockResolvedValue(deleted);
    prisma.client.party.findFirst.mockResolvedValue(null);
    prisma.client.party.update.mockResolvedValue(restored);

    await service.restoreCustomer(BUYER.id);

    expect(prisma.client.party.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BUYER.id },
        data: { deletedAt: null, isActive: true },
      }),
    );
  });

  it('refuses to restore a customer when another live buyer now uses the phone', async () => {
    prisma.client.party.findUnique.mockResolvedValue({
      ...BUYER,
      isActive: false,
      deletedAt: new Date('2026-09-01'),
      assignedAdmin: null,
    });
    prisma.client.party.findFirst.mockResolvedValue({
      id: 99,
      name: 'Replacement Buyer',
    });

    await expect(service.restoreCustomer(BUYER.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.client.party.update).not.toHaveBeenCalled();
  });

  it('reports outstanding as total minus what the ledger says was collected', async () => {
    const dto = await service.findOrder(savedOrder.id);
    expect(dto.total).toBe('860.00');
    expect(dto.paid).toBe('800.00');
    expect(dto.due).toBe('60.00');
    expect(dto.invoiceDocNo).toBe('AR-2608-0004');
  });

  it('reports a cancelled order as owing nothing, so nothing is offered to collect', async () => {
    // Regression: `total − paid` was derived regardless of status, so a
    // cancelled order whose receivable had been voided still reported its full
    // value outstanding — and the orders list put a Collect button beside it.
    prisma.client.wholesaleOrder.findUnique.mockResolvedValue({
      ...savedOrder,
      status: 'CANCELLED',
      dues: [{ ...savedOrder.dues[0], voidedAt: new Date() }],
    });
    ledger.paidForDues.mockResolvedValue(new Map());

    const dto = await service.findOrder(savedOrder.id);
    expect(dto.total).toBe('860.00');
    expect(dto.due).toBe('0.00');
    // No live receivable left to point at either.
    expect(dto.invoiceDocNo).toBeNull();
  });

  it('never reports a negative outstanding balance', async () => {
    ledger.paidForDues.mockResolvedValue(new Map([[90, D('1000.00')]]));
    const dto = await service.findOrder(savedOrder.id);
    expect(dto.due).toBe('0.00');
  });

  describe('editing a placed order', () => {
    // The order on disk: 2 x Jober Sattu @450 = 900, +60 -100 = 860, 800 paid.
    const editable = {
      ...savedOrder,
      dues: [{ id: 90, kind: 'RECEIVABLE' as const }],
    };

    beforeEach(() => {
      prisma.client.wholesaleOrder.findUnique.mockResolvedValue(editable);
      prisma.client.wholesaleOrder.update = jest.fn();
      // Nothing collected by default, so these cases exercise the stock and
      // invoice maths rather than tripping the already-paid floor. The one
      // test that cares about that floor sets its own figure.
      ledger.paidForDues.mockResolvedValue(new Map([[90, D('0')]]));
    });

    it('moves stock by the difference, not the whole line again', async () => {
      // 2 -> 3 of the same product is one more unit leaving, not three.
      await service.updateOrder(savedOrder.id, {
        items: [{ productId: 1, unitPrice: '450', quantity: 3 }],
      });
      expect(tx.product.update).toHaveBeenCalledTimes(1);
      expect(tx.product.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { stock: { decrement: 1 } },
      });
    });

    it('returns stock when a line shrinks', async () => {
      await service.updateOrder(savedOrder.id, {
        items: [{ productId: 1, unitPrice: '450', quantity: 1 }],
      });
      expect(tx.product.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { stock: { increment: 1 } },
      });
    });

    it('moves no stock at all when only the rate changes', async () => {
      await service.updateOrder(savedOrder.id, {
        items: [{ productId: 1, unitPrice: '400', quantity: 2 }],
      });
      expect(tx.product.update).not.toHaveBeenCalled();
    });

    it('restates the invoice to the new total, keeping the same due', async () => {
      await service.updateOrder(savedOrder.id, {
        items: [{ productId: 1, unitPrice: '500', quantity: 2 }],
      });
      // 1000 + 60 - 100 = 960
      expect(tx.due.update).toHaveBeenCalledWith({
        where: { id: 90 },
        data: { amount: expect.objectContaining({}) },
      });
      const amount = tx.due.update.mock.calls[0][0].data.amount;
      expect(amount.toFixed(2)).toBe('960.00');
    });

    it('keeps the delivery charge when only the lines are sent', async () => {
      await service.updateOrder(savedOrder.id, {
        items: [{ productId: 1, unitPrice: '450', quantity: 2 }],
      });
      const data = tx.wholesaleOrder.update.mock.calls[0][0].data;
      expect(data.deliveryCharge.toFixed(2)).toBe('60.00');
      expect(data.discount.toFixed(2)).toBe('100.00');
    });

    it('refuses to restate below what has already been collected', async () => {
      ledger.paidForDues.mockResolvedValue(new Map([[90, D('800.00')]]));
      // 800 is already collected; one unit at 450 nets 410.
      await expect(
        service.updateOrder(savedOrder.id, {
          items: [{ productId: 1, unitPrice: '450', quantity: 1 }],
          deliveryCharge: '0',
          discount: '0',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.due.update).not.toHaveBeenCalled();
    });

    it('refuses to edit a cancelled order', async () => {
      prisma.client.wholesaleOrder.findUnique.mockResolvedValue({
        ...editable,
        status: 'CANCELLED',
      });
      await expect(
        service.updateOrder(savedOrder.id, {
          items: [{ productId: 1, unitPrice: '450', quantity: 1 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('a light-field edit touches neither stock nor the invoice', async () => {
      await service.updateOrder(savedOrder.id, { consignmentId: 'SB-11' });
      expect(tx.product.update).not.toHaveBeenCalled();
      expect(tx.due.update).not.toHaveBeenCalled();
    });
  });

  it('allows two buyers to trade under the same name, but not the same number', async () => {
    prisma.client.party.findFirst.mockResolvedValue(null);
    prisma.client.party.create.mockResolvedValue({ ...BUYER, id: 8 });
    await expect(
      service.createCustomer({ name: 'Rahman Grocery', phone: '01722222222' }),
    ).resolves.toBeDefined();

    prisma.client.party.findFirst.mockResolvedValue({
      id: 7,
      name: 'Rahman Grocery',
    });
    await expect(
      service.createCustomer({ name: 'Rahman Grocery', phone: '01711111111' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
