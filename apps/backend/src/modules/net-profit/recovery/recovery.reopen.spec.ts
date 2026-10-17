import { RecoveryService } from './recovery.service';

// A recovered order that got cancelled sends its cart back to Recovery.
describe('RecoveryService.reopenFromOrder', () => {
  function make(status: string, count = 1) {
    const prisma = {
      client: {
        order: { findUnique: jest.fn().mockResolvedValue({ status }) },
        incompleteOrder: { updateMany: jest.fn().mockResolvedValue({ count }) },
      },
    };
    const svc = new (RecoveryService as unknown as new (...a: unknown[]) => RecoveryService)(prisma);
    return { svc, prisma };
  }

  it('reopens the cart that became this cancelled order', async () => {
    const { svc, prisma } = make('CANCELED');
    expect(await svc.reopenFromOrder(9)).toEqual({ reopened: 1 });
    expect(prisma.client.incompleteOrder.updateMany).toHaveBeenCalledWith({
      where: { recoveredOrderId: 9 },
      data: { recovered: false, recoveredOrderId: null },
    });
  });

  it('refuses an order that is not cancelled, or did not come from Recovery', async () => {
    await expect(make('PROCESSING').svc.reopenFromOrder(9)).rejects.toThrow(/Cancel the order first/);
    await expect(make('CANCELED', 0).svc.reopenFromOrder(9)).rejects.toThrow(/did not come from Recovery/);
  });
});
