import { BkashCallbackService } from './bkash-callback.service';

function make(config: { orderStatusAfterVerify: string } | null) {
  const prisma = {
    client: {
      paymentMethodConfig: { findUnique: jest.fn().mockResolvedValue(config) },
      order: { update: jest.fn() },
    },
  };
  const events = { emit: jest.fn() };
  const svc = new BkashCallbackService(
    prisma as never, {} as never, {} as never, {} as never, {} as never, events as never,
  );
  const advance = (status: string) =>
    (svc as unknown as { advanceOrder: (id: number, s: string) => Promise<void> }).advanceOrder(5, status);
  return { advance, prisma, events };
}

describe('bKash payment → order status', () => {
  it('Pending (the default) leaves the order Pending for staff to confirm', async () => {
    for (const cfg of [{ orderStatusAfterVerify: 'PENDING' }, null]) {
      const { advance, prisma, events } = make(cfg);
      await advance('PENDING');
      expect(prisma.client.order.update).not.toHaveBeenCalled();
      expect(events.emit).not.toHaveBeenCalled();
    }
  });

  it('another chosen status still moves a pending order on', async () => {
    const { advance, prisma } = make({ orderStatusAfterVerify: 'CONFIRMED' });
    await advance('PENDING');
    expect(prisma.client.order.update.mock.calls[0][0].data.status).toBe('CONFIRMED');
  });
});
