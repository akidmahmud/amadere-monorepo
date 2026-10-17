import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@amader/db';
import { AdminOrderCreationService } from './admin-order-creation.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PricingService } from '../cart/pricing.service';
import { PaymentsService } from '../payments/payments.service';
import { OrderEmailsService } from '../order-emails/order-emails.service';
import { DownloadsService } from '../digital-products/downloads.service';
import { CreateManualOrderDto } from './dto/create-manual-order.dto';

const Decimal = Prisma.Decimal;

// The mapper's own tests (orders.mapper isn't the thing under test here)
// pull in the full ORDER_INCLUDE shape — stubbed out so this test only has
// to supply whatever the final findUniqueOrThrow mock returns, unchanged.
jest.mock('./orders.mapper', () => ({
  ORDER_INCLUDE: {},
  toOrderDto: jest.fn((order: unknown) => order),
}));

function createMockPrismaService() {
  const client = {
    // findUniqueOrThrow is stock-reservation.util's own lookup — trackInventory:
    // false makes it a no-op so this test doesn't have to also model stock.
    product: { findMany: jest.fn(), findUniqueOrThrow: jest.fn().mockResolvedValue({ trackInventory: false }) },
    order: { create: jest.fn(), findUniqueOrThrow: jest.fn() },
    customerAddress: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
    discount: { findUnique: jest.fn(), update: jest.fn() },
    discountRedemption: { create: jest.fn() },
    payment: { create: jest.fn() },
    // Same pattern as digital-products.service.spec.ts — a plain object
    // stand-in, so $transaction just runs the callback against these mocks.
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(client)),
  };
  return { client };
}

type MockPrisma = ReturnType<typeof createMockPrismaService>;

function baseDto(overrides: Partial<CreateManualOrderDto> = {}): CreateManualOrderDto {
  return {
    channel: 'PHONE',
    shippingAddress: {
      recipientName: 'Test Customer',
      phone: '01711111111',
      district: 'Dhaka',
      area: 'Mirpur',
      addressLine: 'Road 1, House 1',
    },
    items: [{ productId: 1, quantity: 1 }],
    paymentProvider: 'COD',
    ...overrides,
  } as CreateManualOrderDto;
}

describe('AdminOrderCreationService.create — productTypeSnapshot', () => {
  let service: AdminOrderCreationService;
  let prisma: MockPrisma;
  let pricing: { priceLines: jest.Mock; price: jest.Mock };
  let payments: { resolve: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrismaService();
    pricing = {
      priceLines: jest.fn().mockResolvedValue([
        { productId: 1, variantId: null, unitPrice: new Decimal(500), lineTotal: new Decimal(500) },
      ]),
      price: jest.fn(),
    };
    payments = {
      resolve: jest.fn().mockReturnValue({
        authorize: jest.fn().mockResolvedValue({ status: 'PENDING', transactionRef: null, rawResponse: null }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminOrderCreationService,
        { provide: PrismaService, useValue: prisma },
        { provide: PricingService, useValue: pricing },
        { provide: PaymentsService, useValue: payments },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: OrderEmailsService, useValue: { sendOrderPlaced: jest.fn(), sendNewOrderAdminNotice: jest.fn() } },
        { provide: DownloadsService, useValue: { createForOrder: jest.fn() } },
      ],
    }).compile();
    service = module.get(AdminOrderCreationService);

    prisma.client.order.create.mockResolvedValue({ id: 42 });
    prisma.client.order.findUniqueOrThrow.mockResolvedValue({ id: 42 });
  });

  it('snapshots DIGITAL for a staff-created New Order line on a digital product', async () => {
    prisma.client.product.findMany.mockResolvedValue([
      { id: 1, sku: 'EBOOK-1', slug: 'ebook-1', productType: 'DIGITAL', translations: [{ name: 'My Ebook' }], variants: [] },
    ]);

    await service.create(baseDto(), 1);

    const orderData = prisma.client.order.create.mock.calls[0][0].data;
    expect(orderData.items.create[0].productTypeSnapshot).toBe('DIGITAL');
  });

  it('still snapshots PHYSICAL for an ordinary staff-created New Order line', async () => {
    prisma.client.product.findMany.mockResolvedValue([
      { id: 1, sku: 'MUG-1', slug: 'mug-1', productType: 'PHYSICAL', translations: [{ name: 'A Mug' }], variants: [] },
    ]);

    await service.create(baseDto(), 1);

    const orderData = prisma.client.order.create.mock.calls[0][0].data;
    expect(orderData.items.create[0].productTypeSnapshot).toBe('PHYSICAL');
  });
});

describe('AdminOrderCreationService.exchange', () => {
  let service: AdminOrderCreationService;
  let prisma: MockPrisma & { client: { order: { findUnique: jest.Mock } } };

  const original = (status = 'COMPLETED') => ({
    id: 50,
    orderNumber: 'ORD-50',
    status,
    channel: 'PHONE',
    customerId: 3,
    items: [
      { id: 501, productId: 7, variantId: null, quantity: 2, unitPrice: new Decimal(325), productNameSnapshot: 'Turmeric' },
      { id: 502, productId: 8, variantId: null, quantity: 1, unitPrice: new Decimal(900), productNameSnapshot: 'Oil' },
    ],
    addresses: [
      {
        type: 'SHIPPING',
        recipientName: 'Karim',
        phone: '01711111111',
        alternativePhone: null,
        email: null,
        division: 'Dhaka',
        district: 'Dhaka',
        area: 'Mirpur',
        landmark: null,
        addressLine: 'Road 1',
        postCode: null,
      },
    ],
  });

  beforeEach(async () => {
    prisma = createMockPrismaService() as typeof prisma;
    (prisma.client.order as { findUnique?: jest.Mock }).findUnique = jest.fn().mockResolvedValue(original());
    prisma.client.product.findMany.mockResolvedValue([
      { id: 7, sku: 'TUR', slug: 'turmeric', productType: 'PHYSICAL', translations: [{ name: 'Turmeric' }], variants: [] },
    ]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminOrderCreationService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: PricingService,
          useValue: {
            priceLines: jest.fn().mockResolvedValue([
              { productId: 7, variantId: null, unitPrice: new Decimal(325), lineTotal: new Decimal(325) },
            ]),
            price: jest.fn(),
          },
        },
        {
          provide: PaymentsService,
          useValue: {
            resolve: jest.fn().mockReturnValue({
              authorize: jest.fn().mockResolvedValue({ status: 'PENDING', transactionRef: null, rawResponse: null }),
            }),
          },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: OrderEmailsService, useValue: { sendOrderPlaced: jest.fn(), sendNewOrderAdminNotice: jest.fn() } },
        { provide: DownloadsService, useValue: { createForOrder: jest.fn() } },
      ],
    }).compile();
    service = module.get(AdminOrderCreationService);
    prisma.client.order.create.mockResolvedValue({ id: 60 });
    prisma.client.order.findUniqueOrThrow.mockResolvedValue({ id: 60 });
  });

  it('creates a linked ৳0 order for the chosen items, shipping ৳0, no discount', async () => {
    await service.exchange(50, { items: [{ itemId: 501, quantity: 1 }], reason: 'Smelled bad' }, 9);
    const data = prisma.client.order.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      exchangeOfOrderId: 50,
      subTotal: new Decimal(0),
      discountAmount: new Decimal(0),
      shippingAmount: new Decimal(0),
      totalAmount: new Decimal(0),
      staffNote: 'Exchange for #ORD-50 — Smelled bad',
    });
    expect(data.items.create).toEqual([
      expect.objectContaining({ productId: 7, quantity: 1, unitPrice: new Decimal(0) }),
    ]);
  });

  it('refuses an order that was never delivered', async () => {
    prisma.client.order.findUnique.mockResolvedValue(original('PROCESSING'));
    await expect(service.exchange(50, { items: [{ itemId: 501, quantity: 1 }] }, 9)).rejects.toThrow(/delivered/);
  });

  it('refuses more than the original quantity, or a line from another order', async () => {
    await expect(service.exchange(50, { items: [{ itemId: 501, quantity: 3 }] }, 9)).rejects.toThrow(/at most 2/);
    await expect(service.exchange(50, { items: [{ itemId: 999, quantity: 1 }] }, 9)).rejects.toThrow(/not on this order/);
  });

  it('a line sent twice is added up against the original quantity', async () => {
    await expect(
      service.exchange(50, { items: [{ itemId: 501, quantity: 2 }, { itemId: 501, quantity: 1 }] }, 9),
    ).rejects.toThrow(/at most 2/);
  });

  it('refuses an order in the Trash, and a POS sale', async () => {
    prisma.client.order.findUnique.mockResolvedValue({ ...original(), deletedAt: new Date() });
    await expect(service.exchange(50, { items: [{ itemId: 501, quantity: 1 }] }, 9)).rejects.toThrow(/Trash/);
    prisma.client.order.findUnique.mockResolvedValue({ ...original(), channel: 'POS' });
    await expect(service.exchange(50, { items: [{ itemId: 501, quantity: 1 }] }, 9)).rejects.toThrow(/POS/);
  });
});

