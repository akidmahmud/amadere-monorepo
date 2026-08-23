import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrdersService } from './orders.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { PricingService } from '../cart/pricing.service';
import { OrderEmailsService } from '../order-emails/order-emails.service';
import { DownloadsService } from '../digital-products/downloads.service';
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
    orderStatusHistory: { create: jest.fn() },
    payment: { findFirst: jest.fn(), update: jest.fn() },
    // Same pattern as admin-order-creation.service.spec.ts — $transaction
    // just runs the callback against these mocks (tx === client).
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
