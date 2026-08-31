import { ConflictException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';

// The guards here are the whole safety story for a public, unauthenticated
// endpoint that CANCELS an order. Each one exists because the alternative is
// a customer losing a paid order or someone else's order being cancelled.
function makeService(opts: {
  payment?: { orderId: number; status: string } | null;
  order?: { id: number; status: string; items: unknown[]; addresses: unknown[] } | null;
}) {
  const prisma = {
    client: {
      payment: { findFirst: jest.fn().mockResolvedValue(opts.payment ?? null) },
      order: { findUnique: jest.fn().mockResolvedValue(opts.order ?? null) },
    },
  } as never;
  const cart = { addItem: jest.fn().mockResolvedValue(undefined) } as never;
  const service = new OrdersService(
    prisma,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    cart,
  );
  const updateStatus = jest.spyOn(service, 'updateStatus').mockResolvedValue({} as never);
  return { service, updateStatus, cart: cart as unknown as { addItem: jest.Mock } };
}

const PENDING_ORDER = {
  id: 7,
  status: 'PENDING',
  items: [
    { productId: 11, variantId: null, quantity: 2 },
    { productId: 12, variantId: 3, quantity: 1 },
  ],
  addresses: [{ recipientName: 'A' }],
};

describe('OrdersService.restoreCartFromPayment', () => {
  it('cancels BEFORE restoring, so the order stops reserving its own stock', async () => {
    // CartService.addItem validates against `stock - reservedStock`. While
    // the order is still open it reserves exactly the lines being restored,
    // so restoring first made every add fail with "Insufficient stock" and
    // handed the customer an empty cart.
    const calls: string[] = [];
    const { service, updateStatus, cart } = makeService({
      payment: { orderId: 7, status: 'PENDING' },
      order: PENDING_ORDER,
    });
    updateStatus.mockImplementation(async () => {
      calls.push('cancel');
      return {} as never;
    });
    cart.addItem.mockImplementation(async () => {
      calls.push('add');
    });

    await service.restoreCartFromPayment({ guestToken: 'g' }, 'PAY-1', 'EN');

    expect(calls).toEqual(['cancel', 'add', 'add']);
  });

  it('restores every line and cancels the order', async () => {
    const { service, updateStatus, cart } = makeService({
      payment: { orderId: 7, status: 'PENDING' },
      order: PENDING_ORDER,
    });

    const result = await service.restoreCartFromPayment({ guestToken: 'g' }, 'PAY-1', 'EN');

    expect(result.restored).toBe(2);
    expect(cart.addItem).toHaveBeenCalledTimes(2);
    expect(cart.addItem).toHaveBeenCalledWith(
      { guestToken: 'g' },
      { productId: 11, variantId: undefined, quantity: 2 },
      'EN',
    );
    expect(updateStatus).toHaveBeenCalledWith(
      7,
      { status: 'CANCELED', note: 'Customer cancelled the bKash payment' },
      null,
    );
  });

  it('refuses to cancel a payment that actually captured', async () => {
    const { service, updateStatus } = makeService({
      payment: { orderId: 7, status: 'CAPTURED' },
      order: PENDING_ORDER,
    });
    await expect(
      service.restoreCartFromPayment({ guestToken: 'g' }, 'PAY-1', 'EN'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it('refuses an unknown paymentID', async () => {
    const { service, updateStatus } = makeService({ payment: null });
    await expect(
      service.restoreCartFromPayment({ guestToken: 'g' }, 'nope', 'EN'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it('refuses once staff have moved the order on', async () => {
    const { service, updateStatus } = makeService({
      payment: { orderId: 7, status: 'PENDING' },
      order: { ...PENDING_ORDER, status: 'PROCESSING' },
    });
    await expect(
      service.restoreCartFromPayment({ guestToken: 'g' }, 'PAY-1', 'EN'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it('still cancels when a line can no longer be added back', async () => {
    const { service, updateStatus, cart } = makeService({
      payment: { orderId: 7, status: 'FAILED' },
      order: PENDING_ORDER,
    });
    cart.addItem.mockRejectedValueOnce(new Error('Insufficient stock'));

    const result = await service.restoreCartFromPayment({ guestToken: 'g' }, 'PAY-1', 'EN');

    expect(result.restored).toBe(1);
    expect(updateStatus).toHaveBeenCalled();
  });

  it('skips a line whose product has since been deleted', async () => {
    const { service, cart } = makeService({
      payment: { orderId: 7, status: 'PENDING' },
      order: { ...PENDING_ORDER, items: [{ productId: null, variantId: null, quantity: 1 }] },
    });
    const result = await service.restoreCartFromPayment({ guestToken: 'g' }, 'PAY-1', 'EN');
    expect(result.restored).toBe(0);
    expect(cart.addItem).not.toHaveBeenCalled();
  });
});
