import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrdersService } from './orders.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { PricingService } from '../cart/pricing.service';
import { OrderEmailsService } from '../order-emails/order-emails.service';
import { DownloadsService } from '../digital-products/downloads.service';
import { CartService } from '../cart/cart.service';
import { StockService } from '../stock/stock.service';

jest.mock('./orders.mapper', () => ({
  ORDER_INCLUDE: {},
  toOrderDto: jest.fn((order: unknown) => order),
}));

function createMockPrismaService() {
  const client = {
    order: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 1 }),
      update: jest.fn(),
    },
    store: { findUnique: jest.fn() },
    product: { update: jest.fn() },
    productVariant: { update: jest.fn() },
    orderStatusHistory: { create: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) },
    payment: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    },
    discountRedemption: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    discount: { update: jest.fn(), updateMany: jest.fn() },
    $queryRaw: jest.fn(), // lockOrderRow
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(client)),
  };
  return { client };
}

const line = {
  productId: 10,
  variantId: null,
  quantity: 2,
  productTypeSnapshot: 'PHYSICAL',
};

describe('OrdersService.updateStatus — POS orders use their store', () => {
  let service: OrdersService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let stock: { move: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrismaService();
    stock = { move: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: PaymentsService, useValue: {} },
        { provide: PricingService, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        {
          provide: OrderEmailsService,
          useValue: {
            sendOrderConfirmed: jest.fn(),
            sendOrderCanceled: jest.fn(),
            sendOrderDelivered: jest.fn(),
          },
        },
        { provide: DownloadsService, useValue: { unlockForOrder: jest.fn() } },
        { provide: CartService, useValue: {} },
        { provide: StockService, useValue: stock },
      ],
    }).compile();
    service = module.get(OrdersService);
  });

  it('returning a POS order restocks the sale store via StockService, not website stock', async () => {
    prisma.client.order.findUnique.mockResolvedValue({
      id: 1,
      status: 'COMPLETED',
      completedAt: new Date(),
      storeId: 4,
      deletedAt: null,
      assignedAdminId: 9,
      items: [line],
    });
    prisma.client.store.findUnique.mockResolvedValue({
      id: 4,
      isOnlineStore: false,
    });

    await service.updateStatus(1, { status: 'RETURNED' } as never, 9);

    expect(stock.move).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        storeId: 4,
        productId: 10,
        variantId: null,
        type: 'RETURN',
        qty: 2,
        orderId: 1,
      }),
    );
    expect(prisma.client.product.update).not.toHaveBeenCalled();
  });

  it('re-completing a returned POS order takes the stock out of the store again', async () => {
    prisma.client.order.findUnique.mockResolvedValue({
      id: 1,
      status: 'RETURNED',
      completedAt: new Date(),
      storeId: 4,
      deletedAt: null,
      assignedAdminId: 9,
      items: [line],
    });
    prisma.client.store.findUnique.mockResolvedValue({
      id: 4,
      isOnlineStore: false,
    });

    await service.updateStatus(1, { status: 'COMPLETED' } as never, 9);

    expect(stock.move).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ storeId: 4, type: 'SALE', qty: -2 }),
    );
    expect(prisma.client.product.update).not.toHaveBeenCalled();
  });

  it('a website order (no storeId) still restocks website stock directly', async () => {
    prisma.client.order.findUnique.mockResolvedValue({
      id: 2,
      status: 'COMPLETED',
      completedAt: new Date(),
      storeId: null,
      deletedAt: null,
      assignedAdminId: 9,
      items: [line],
    });

    await service.updateStatus(2, { status: 'RETURNED' } as never, 9);

    expect(stock.move).not.toHaveBeenCalled();
    expect(prisma.client.product.update).toHaveBeenCalled();
  });
});

describe('OrdersService.updateStatus — return date and re-completion', () => {
  let service: OrdersService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let stock: { move: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrismaService();
    stock = { move: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: PaymentsService, useValue: {} },
        { provide: PricingService, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: OrderEmailsService, useValue: { sendOrderConfirmed: jest.fn(), sendOrderCanceled: jest.fn(), sendOrderDelivered: jest.fn() } },
        { provide: DownloadsService, useValue: { unlockForOrder: jest.fn() } },
        { provide: CartService, useValue: {} },
        { provide: StockService, useValue: stock },
      ],
    }).compile();
    service = module.get(OrdersService);
  });

  it('locks the order and re-reads it: a POS return that won the race means no second restock', async () => {
    const completed = { id: 8, status: 'COMPLETED', completedAt: new Date(), storeId: 4, deletedAt: null, assignedAdminId: 9, items: [line] };
    prisma.client.order.findUnique
      .mockResolvedValueOnce(completed) // read before the transaction
      .mockResolvedValueOnce({ ...completed, status: 'RETURNED' }); // re-read under the row lock
    prisma.client.store.findUnique.mockResolvedValue({ id: 4, isOnlineStore: false });
    await service.updateStatus(8, { status: 'RETURNED' } as never, 9);
    expect(prisma.client.$queryRaw).toHaveBeenCalled();
    expect(stock.move).not.toHaveBeenCalled();
    expect(prisma.client.order.update).not.toHaveBeenCalled();
  });

  it('clears returnedAt when a return is undone (RETURNED → COMPLETED)', async () => {
    prisma.client.order.findUnique.mockResolvedValue({
      id: 12, status: 'RETURNED', completedAt: new Date(), storeId: null, deletedAt: null, assignedAdminId: 9, items: [line],
    });
    await service.updateStatus(12, { status: 'COMPLETED' } as never, 9);
    expect(prisma.client.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ returnedAt: null }) }),
    );
  });

  it('records returnedAt when an order moves to RETURNED', async () => {
    prisma.client.order.findUnique.mockResolvedValue({
      id: 3, status: 'COMPLETED', completedAt: new Date(), storeId: null, deletedAt: null, assignedAdminId: 9, items: [line],
    });
    await service.updateStatus(3, { status: 'RETURNED' } as never, 9);
    expect(prisma.client.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ returnedAt: expect.any(Date) }) }),
    );
  });

  it('COMPLETED → CANCELED → PROCESSING → CANCELED does not restock twice', async () => {
    prisma.client.order.findUnique.mockResolvedValue({
      id: 6, status: 'PROCESSING', completedAt: new Date(), storeId: null, deletedAt: null, assignedAdminId: 9, items: [line],
    });
    prisma.client.orderStatusHistory.findFirst.mockResolvedValue({ status: 'CANCELED' }); // stock already back
    await service.updateStatus(6, { status: 'CANCELED' } as never, 9);
    expect(prisma.client.product.update).not.toHaveBeenCalled();
  });

  it('COMPLETED → CANCELED → PROCESSING → COMPLETED takes the stock out again', async () => {
    prisma.client.order.findUnique.mockResolvedValue({
      id: 7, status: 'PROCESSING', completedAt: new Date(), storeId: null, deletedAt: null, assignedAdminId: 9, items: [line],
    });
    prisma.client.orderStatusHistory.findFirst.mockResolvedValue({ status: 'CANCELED' });
    await service.updateStatus(7, { status: 'COMPLETED' } as never, 9);
    expect(prisma.client.product.update).toHaveBeenCalled();
  });

  it('COMPLETED → PROCESSING → COMPLETED does not take the stock a second time', async () => {
    prisma.client.order.findUnique.mockResolvedValue({
      id: 4, status: 'PROCESSING', completedAt: new Date(), storeId: null, deletedAt: null, assignedAdminId: 9, items: [line],
    });
    await service.updateStatus(4, { status: 'COMPLETED' } as never, 9);
    expect(prisma.client.product.update).not.toHaveBeenCalled();
    expect(stock.move).not.toHaveBeenCalled();
  });
});

describe('OrdersService.updateAmounts — POS sales', () => {
  it('refuses to re-price a POS sale (a POS sale is corrected by a return)', async () => {
    const prisma = createMockPrismaService();
    prisma.client.order.findUnique.mockResolvedValue({ id: 9, channel: 'POS', status: 'COMPLETED', discountAmount: 0 });
    const svc = new OrdersService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
    await expect(svc.updateAmounts(9, { discountAmount: 10 } as never)).rejects.toThrow(/POS sale/i);
    expect(prisma.client.order.update).not.toHaveBeenCalled();
  });
});
