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
import { Prisma } from '@amader/db';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

// reload() pulls in the full ORDER_INCLUDE shape via orders.mapper — stubbed
// out the same way admin-order-creation.service.spec.ts does, so this test
// only has to supply whatever findUniqueOrThrow returns, unchanged.
jest.mock('./orders.mapper', () => ({
  ORDER_INCLUDE: {},
  toOrderDto: jest.fn((order: unknown) => order),
}));

function createMockPrismaService() {
  const client = {
    order: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
    product: { update: jest.fn() },
    productVariant: { update: jest.fn() },
    // Returns record per-line back-to-stock / written-off counts.
    orderItem: { update: jest.fn(), updateMany: jest.fn() },
    orderStatusHistory: { create: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) },
    payment: { findFirst: jest.fn(), update: jest.fn() },
    // A cancel gives back any coupon use; these orders have none.
    discountRedemption: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
    discount: { update: jest.fn(), updateMany: jest.fn() },
    // Same pattern as admin-order-creation.service.spec.ts — $transaction
    // just runs the callback against these mocks (tx === client).
    $queryRaw: jest.fn(), // lockOrderRow
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(client)),
  };
  return { client };
}

type MockPrisma = ReturnType<typeof createMockPrismaService>;

describe('OrdersService.updateStatus — digital lines and stock reservation', () => {
  let service: OrdersService;
  let prisma: MockPrisma;
  let downloads: { unlockForOrder: jest.Mock; createForOrder: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrismaService();
    downloads = { unlockForOrder: jest.fn(), createForOrder: jest.fn() };

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
        { provide: DownloadsService, useValue: downloads },
        // Only used by restoreCartFromPayment, which these tests never reach.
        { provide: CartService, useValue: { addItem: jest.fn() } },
        { provide: StockService, useValue: { move: jest.fn() } },
      ],
    }).compile();
    service = module.get(OrdersService);

    prisma.client.payment.findFirst.mockResolvedValue(null);
    prisma.client.order.findUniqueOrThrow.mockResolvedValue({ id: 7 });
  });

  // Realistic repro for Fix round 2's finding: a customer or staff member
  // cancels a still-PENDING order that has a free (or paid) digital line
  // sitting next to a physical one. Before this fix, releaseReservations
  // ran over every line including the digital one, which was never
  // reserved at checkout — decrementing its reservedStock straight into
  // negative.
  it('does not release a reservation for a digital line on cancel, but still releases the physical one', async () => {
    prisma.client.order.findUnique.mockResolvedValue({
      id: 7,
      status: 'PENDING',
      completedAt: null,
      items: [
        { productId: 10, variantId: null, quantity: 1, productTypeSnapshot: 'DIGITAL' },
        { productId: 11, variantId: null, quantity: 2, productTypeSnapshot: 'PHYSICAL' },
      ],
    });

    await service.updateStatus(
      7,
      { status: 'CANCELED', note: 'Customer canceled' } as UpdateOrderStatusDto,
      null,
    );

    // The physical line's reservation is released, exactly as before this fix.
    expect(prisma.client.product.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { reservedStock: { decrement: 2 } },
    });
    // The digital line must never be touched — it was never reserved.
    expect(prisma.client.product.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 10 } }),
    );
    expect(prisma.client.product.update).toHaveBeenCalledTimes(1);
  });

  it('does not decrement stock for a digital line when completing an order that detoured through CANCELED', async () => {
    // wasEverCompleted: true (completedAt already set) routes COMPLETED
    // through decrementStockOnly rather than commitReservations — same
    // digital-skip rule has to hold there too.
    prisma.client.order.findUnique.mockResolvedValue({
      id: 7,
      status: 'PROCESSING',
      completedAt: new Date('2026-01-01'),
      items: [
        { productId: 10, variantId: null, quantity: 1, productTypeSnapshot: 'DIGITAL' },
        { productId: 11, variantId: null, quantity: 2, productTypeSnapshot: 'PHYSICAL' },
      ],
    });
    // The detour: its latest stock-affecting history entry is the CANCELED.
    prisma.client.orderStatusHistory.findFirst.mockResolvedValue({ status: 'CANCELED' });

    await service.updateStatus(
      7,
      { status: 'COMPLETED', note: 'Re-completed' } as UpdateOrderStatusDto,
      null,
    );

    expect(prisma.client.product.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { stock: { decrement: 2 } },
    });
    expect(prisma.client.product.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 10 } }),
    );
    expect(prisma.client.product.update).toHaveBeenCalledTimes(1);
  });

  it('does not restock a digital line on a return after COMPLETED, but still restocks the physical one', async () => {
    // wasEverCompleted: true (completedAt already set) plus a transition
    // into RETURNED routes through restockReturnedItems — same digital-skip
    // rule as the other three sibling functions (Fix round 3). A digital
    // line was never decremented by commitReservations in the first place
    // (round 2's fix), so restocking it here would inflate stock: for a
    // product that never had any.
    prisma.client.order.findUnique.mockResolvedValue({
      id: 7,
      status: 'PROCESSING',
      completedAt: new Date('2026-01-01'),
      items: [
        { productId: 10, variantId: null, quantity: 1, productTypeSnapshot: 'DIGITAL' },
        { productId: 11, variantId: null, quantity: 2, productTypeSnapshot: 'PHYSICAL' },
      ],
    });

    await service.updateStatus(
      7,
      { status: 'RETURNED', note: 'Customer returned the physical item' } as UpdateOrderStatusDto,
      null,
    );

    expect(prisma.client.product.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { stock: { increment: 2 } },
    });
    expect(prisma.client.product.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 10 } }),
    );
    expect(prisma.client.product.update).toHaveBeenCalledTimes(1);
  });
});

describe('OrdersService.updateItemQuantity — line price', () => {
  function build(status = 'CONFIRMED') {
    const client = {
      order: {
        findUnique: jest.fn().mockResolvedValue({ id: 7, status }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 7,
          subTotal: new Prisma.Decimal(740), // 2 × 325 + 1 × 90
          discountAmount: new Prisma.Decimal(0),
          taxAmount: new Prisma.Decimal(0),
          codFee: new Prisma.Decimal(0),
          shippingAmount: new Prisma.Decimal(0),
        }),
        update: jest.fn(),
      },
      orderItem: {
        findUnique: jest.fn().mockResolvedValue({
          id: 70, orderId: 7, productId: 11, variantId: null, quantity: 2, unitPrice: new Prisma.Decimal(325),
        }),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([
          { unitPrice: new Prisma.Decimal(0), quantity: 2 },
          { unitPrice: new Prisma.Decimal(90), quantity: 1 },
        ]),
      },
      product: { update: jest.fn(), findUniqueOrThrow: jest.fn() },
      productVariant: { update: jest.fn() },
      $queryRaw: jest.fn(),
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(client)),
    };
    const service = new OrdersService(
      { client } as never, {} as never, {} as never, { emit: jest.fn() } as never,
      {} as never, {} as never, {} as never, { move: jest.fn() } as never,
    );
    return { service, client };
  }

  it('sets a line to ৳0 without touching stock, then re-totals', async () => {
    const { service, client } = build();
    await service.updateItemQuantity(7, 70, { unitPrice: 0 });
    expect(client.orderItem.update).toHaveBeenCalledWith({
      where: { id: 70 },
      data: { quantity: 2, unitPrice: new Prisma.Decimal(0) },
    });
    expect(client.product.update).not.toHaveBeenCalled();
    expect(client.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { subTotal: new Prisma.Decimal(90), totalAmount: new Prisma.Decimal(90) } }),
    );
  });

  it('a manual order with a below-catalog line keeps its discount once (no double count)', async () => {
    // Made at catalog ৳1000, typed ৳800: stored subTotal 1000, discount 200, total 800.
    const { service, client } = build();
    client.orderItem.findUnique.mockResolvedValue({
      id: 70, orderId: 7, productId: 11, variantId: null, quantity: 1, unitPrice: new Prisma.Decimal(800),
    });
    client.order.findUniqueOrThrow.mockResolvedValue({
      id: 7,
      subTotal: new Prisma.Decimal(1000),
      discountAmount: new Prisma.Decimal(200),
      taxAmount: new Prisma.Decimal(0),
      codFee: new Prisma.Decimal(0),
      shippingAmount: new Prisma.Decimal(0),
    });
    await service.updateItemQuantity(7, 70, { unitPrice: 700 });
    // ৳100 off the line → ৳100 off the order: 700, not 500.
    expect(client.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { subTotal: new Prisma.Decimal(900), totalAmount: new Prisma.Decimal(700) } }),
    );
  });

  it('needs a quantity or a price', async () => {
    const { service } = build();
    await expect(service.updateItemQuantity(7, 70, {})).rejects.toThrow(/quantity or price/);
  });

  it('is refused once the order is completed', async () => {
    const { service } = build('COMPLETED');
    await expect(service.updateItemQuantity(7, 70, { unitPrice: 0 })).rejects.toThrow(/can't be edited/);
  });
});

describe('OrdersService.updateStatus — back to stock or write off', () => {
  // A delivered order: 4 × Turmeric (#11), stock already taken.
  function build(over: { status?: string; completedAt?: Date | null; restocked?: number; writtenOff?: number; lastHistory?: string | null } = {}) {
    const item = {
      id: 1,
      productId: 11,
      variantId: null,
      quantity: 4,
      productTypeSnapshot: 'PHYSICAL',
      productNameSnapshot: 'Turmeric',
      restockedQuantity: over.restocked ?? 0,
      writtenOffQuantity: over.writtenOff ?? 0,
    };
    const order = {
      id: 7,
      status: over.status ?? 'COMPLETED',
      completedAt: over.completedAt === undefined ? new Date('2026-10-01') : over.completedAt,
      storeId: null,
      assignedAdminId: 1,
      deletedAt: null,
      items: [item],
    };
    const client = {
      order: {
        findUnique: jest.fn().mockResolvedValue(order),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 7 }),
        update: jest.fn(),
      },
      orderItem: { update: jest.fn(), updateMany: jest.fn() },
      product: { update: jest.fn() },
      productVariant: { update: jest.fn() },
      orderStatusHistory: {
        create: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(
          over.lastHistory === null ? null : { status: over.lastHistory ?? 'COMPLETED' },
        ),
      },
      payment: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
      discountRedemption: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
      discount: { update: jest.fn(), updateMany: jest.fn() },
      $queryRaw: jest.fn(),
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(client)),
    };
    const service = new OrdersService(
      { client } as never, {} as never, {} as never, { emit: jest.fn() } as never,
      { sendOrderConfirmed: jest.fn(), sendOrderCanceled: jest.fn(), sendOrderDelivered: jest.fn() } as never,
      { unlockForOrder: jest.fn(), createForOrder: jest.fn() } as never, {} as never, { move: jest.fn() } as never,
    );
    return { service, client };
  }
  const stockMoves = (client: { product: { update: jest.Mock } }) =>
    client.product.update.mock.calls.map((c) => c[0].data.stock);

  it('no choice = all back (e.g. courier webhook), and the count is recorded', async () => {
    const { service, client } = build();
    await service.updateStatus(7, { status: 'RETURNED' } as UpdateOrderStatusDto, null);
    expect(stockMoves(client)).toEqual([{ increment: 4 }]);
    expect(client.orderItem.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { restockedQuantity: 4, writtenOffQuantity: 0 },
    });
  });

  it('a written-off unit never goes back into stock', async () => {
    const { service, client } = build();
    await service.updateStatus(
      7,
      { status: 'RETURNED', returnLines: [{ itemId: 1, restock: 3, writeOff: 1 }] } as UpdateOrderStatusDto,
      1,
    );
    expect(stockMoves(client)).toEqual([{ increment: 3 }]);
    expect(client.orderItem.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { restockedQuantity: 3, writtenOffQuantity: 1 },
    });
  });

  it('a full return must account for every unit', async () => {
    const { service } = build();
    await expect(
      service.updateStatus(
        7,
        { status: 'RETURNED', returnLines: [{ itemId: 1, restock: 2, writeOff: 1 }] } as UpdateOrderStatusDto,
        1,
      ),
    ).rejects.toThrow(/all 4/);
  });

  it('a partial return may keep some with the customer', async () => {
    const { service, client } = build();
    await service.updateStatus(
      7,
      { status: 'PARTIALLY_RETURNED', returnLines: [{ itemId: 1, restock: 1, writeOff: 1 }] } as UpdateOrderStatusDto,
      1,
    );
    expect(stockMoves(client)).toEqual([{ increment: 1 }]);
  });

  it('re-complete takes back only what was restocked, then clears the counts', async () => {
    const { service, client } = build({ status: 'RETURNED', restocked: 3, writtenOff: 1, lastHistory: 'RETURNED' });
    await service.updateStatus(7, { status: 'COMPLETED' } as UpdateOrderStatusDto, 1);
    expect(stockMoves(client)).toEqual([{ decrement: 3 }]);
    expect(client.orderItem.updateMany).toHaveBeenCalledWith({
      where: { orderId: 7 },
      data: { restockedQuantity: 0, writtenOffQuantity: 0 },
    });
  });

  it('legacy return (no counts recorded) takes back the full quantity', async () => {
    const { service, client } = build({ status: 'RETURNED', lastHistory: 'RETURNED' });
    await service.updateStatus(7, { status: 'COMPLETED' } as UpdateOrderStatusDto, 1);
    expect(stockMoves(client)).toEqual([{ decrement: 4 }]);
    expect(client.orderItem.updateMany).not.toHaveBeenCalled();
  });

  it('a partial return where nothing came back is refused', async () => {
    const { service } = build();
    await expect(
      service.updateStatus(
        7,
        { status: 'PARTIALLY_RETURNED', returnLines: [{ itemId: 1, restock: 0, writeOff: 0 }] } as UpdateOrderStatusDto,
        1,
      ),
    ).rejects.toThrow(/nothing came back/i);
  });

  it('partial then full return restocks the rest and keeps write-offs', async () => {
    // Partially Returned earlier: 1 back, 0 written off. Now all 4 are back: 2 more to stock, 1 damaged.
    const { service, client } = build({ status: 'PARTIALLY_RETURNED', restocked: 1, writtenOff: 0, lastHistory: 'PARTIALLY_RETURNED' });
    await service.updateStatus(
      7,
      { status: 'RETURNED', returnLines: [{ itemId: 1, restock: 3, writeOff: 1 }] } as UpdateOrderStatusDto,
      1,
    );
    expect(stockMoves(client)).toEqual([{ increment: 2 }]);
    expect(client.orderItem.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { restockedQuantity: 3, writtenOffQuantity: 1 },
    });
  });

  it('partial then full return with no choice (courier) puts the rest back', async () => {
    const { service, client } = build({ status: 'PARTIALLY_RETURNED', restocked: 1, writtenOff: 1, lastHistory: 'PARTIALLY_RETURNED' });
    await service.updateStatus(7, { status: 'RETURNED' } as UpdateOrderStatusDto, null);
    expect(stockMoves(client)).toEqual([{ increment: 2 }]);
  });

  it('cannot un-return units already put back', async () => {
    const { service } = build({ status: 'PARTIALLY_RETURNED', restocked: 3, writtenOff: 0, lastHistory: 'PARTIALLY_RETURNED' });
    await expect(
      service.updateStatus(
        7,
        { status: 'RETURNED', returnLines: [{ itemId: 1, restock: 1, writeOff: 3 }] } as UpdateOrderStatusDto,
        1,
      ),
    ).rejects.toThrow(/already/);
  });

  it('refuses a line that is not on the order', async () => {
    const { service } = build();
    await expect(
      service.updateStatus(
        7,
        { status: 'RETURNED', returnLines: [{ itemId: 99, restock: 4, writeOff: 0 }] } as UpdateOrderStatusDto,
        1,
      ),
    ).rejects.toThrow(/not on this order/);
  });

  it('detour (returned → processing → returned): damaged units come off the shelf', async () => {
    // Earlier return put all 4 back; the order went to Processing (no stock taken), now Returned again.
    const { service, client } = build({ status: 'PROCESSING', restocked: 4, writtenOff: 0, lastHistory: 'RETURNED' });
    await service.updateStatus(
      7,
      { status: 'RETURNED', returnLines: [{ itemId: 1, restock: 0, writeOff: 1 }] } as UpdateOrderStatusDto,
      1,
    );
    expect(stockMoves(client)).toEqual([{ decrement: 1 }]);
    expect(client.orderItem.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { restockedQuantity: 3, writtenOffQuantity: 1 },
    });
  });

  it('detour on an order returned before counts existed: all 4 were back, 1 now written off', async () => {
    const { service, client } = build({ status: 'PROCESSING', lastHistory: 'RETURNED' });
    await service.updateStatus(
      7,
      { status: 'RETURNED', returnLines: [{ itemId: 1, restock: 0, writeOff: 1 }] } as UpdateOrderStatusDto,
      1,
    );
    expect(stockMoves(client)).toEqual([{ decrement: 1 }]);
    expect(client.orderItem.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { restockedQuantity: 3, writtenOffQuantity: 1 },
    });
  });

  it('detour: cannot write off more than is back on the shelf', async () => {
    const { service } = build({ status: 'PROCESSING', restocked: 1, writtenOff: 3, lastHistory: 'RETURNED' });
    await expect(
      service.updateStatus(
        7,
        { status: 'RETURNED', returnLines: [{ itemId: 1, restock: 0, writeOff: 5 }] } as UpdateOrderStatusDto,
        1,
      ),
    ).rejects.toThrow(/only 1 back in stock/);
  });

  it('detour with no choice (courier): nothing moves, as before', async () => {
    const { service, client } = build({ status: 'PROCESSING', restocked: 4, lastHistory: 'RETURNED' });
    await service.updateStatus(7, { status: 'RETURNED' } as UpdateOrderStatusDto, null);
    expect(client.product.update).not.toHaveBeenCalled();
    expect(client.orderItem.update).not.toHaveBeenCalled();
  });

  it('never delivered (courier return): reservation released, units kept out come off the shelf', async () => {
    const { service, client } = build({ status: 'PROCESSING', completedAt: null, lastHistory: null });
    await service.updateStatus(
      7,
      { status: 'RETURNED', returnLines: [{ itemId: 1, restock: 1, writeOff: 3 }] } as UpdateOrderStatusDto,
      1,
    );
    expect(client.product.update).toHaveBeenCalledWith({ where: { id: 11 }, data: { reservedStock: { decrement: 4 } } });
    expect(client.product.update).toHaveBeenCalledWith({ where: { id: 11 }, data: { stock: { decrement: 3 } } });
    expect(client.orderItem.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { restockedQuantity: 1, writtenOffQuantity: 3 },
    });
  });

  it('never delivered, no choice: everything released back to stock, as before', async () => {
    const { service, client } = build({ status: 'PROCESSING', completedAt: null, lastHistory: null });
    await service.updateStatus(7, { status: 'RETURNED' } as UpdateOrderStatusDto, 1);
    expect(client.orderItem.update).not.toHaveBeenCalled();
  });

  it('return stock toggle: switching kept-out units into the main inventory restocks them', async () => {
    const { service, client } = build({ status: 'RETURNED', restocked: 0, writtenOff: 4, lastHistory: 'RETURNED' });
    await service.setReturnedStock(7, [{ itemId: 1, restock: 4 }], 1);
    expect(client.product.update).toHaveBeenCalledWith({ where: { id: 11 }, data: { stock: { increment: 4 } } });
    expect(client.orderItem.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { restockedQuantity: 4, writtenOffQuantity: 0 },
    });
  });

  it('return stock toggle: switching off takes them back out; never more than came back', async () => {
    const { service, client } = build({ status: 'RETURNED', restocked: 4, writtenOff: 0, lastHistory: 'RETURNED' });
    await service.setReturnedStock(7, [{ itemId: 1, restock: 0 }], 1);
    expect(client.product.update).toHaveBeenCalledWith({ where: { id: 11 }, data: { stock: { decrement: 4 } } });
    await expect(service.setReturnedStock(7, [{ itemId: 1, restock: 5 }], 1)).rejects.toThrow(/only 4 came back/);
  });
});
