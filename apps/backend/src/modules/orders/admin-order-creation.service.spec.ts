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
