import { Prisma } from '@amader/db';
import { PosSaleService } from './pos-sale.service';

jest.mock('../discounts/coupon-redemption', () => ({
  releaseOrderCoupons: jest.fn(),
  reclaimOrderCoupons: jest.fn(),
}));

const D = (n: number) => new Prisma.Decimal(n);

function make(order: Record<string, unknown>) {
  const tx = {
    order: { update: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    orderStatusHistory: { create: jest.fn() },
    payment: { updateMany: jest.fn() },
  };
  const prisma = {
    client: {
      $transaction: (f: (t: typeof tx) => Promise<unknown>) => f(tx),
      order: { findMany: jest.fn().mockResolvedValue([{ id: 5 }]), delete: jest.fn() },
    },
  };
  const stock = { move: jest.fn() };
  const stores = { tenderAccountId: jest.fn().mockResolvedValue(11) };
  const salesPosting = { postPrepaidCapture: jest.fn() };
  const svc = new PosSaleService(
    prisma as never, stock as never, stores as never, {} as never,
    salesPosting as never, {} as never, {} as never, {} as never,
  );
  jest.spyOn(svc, 'get').mockResolvedValue(order as never);
  const ret = jest.spyOn(svc, 'returnSale').mockResolvedValue({} as never);
  return { svc, tx, prisma, stock, salesPosting, ret };
}

const sale = {
  id: 5, storeId: 4, status: 'COMPLETED', deletedAt: null, posVoidedByDelete: false,
  totalAmount: D(360),
  items: [{ productId: 9, variantId: null, quantity: 2 }],
  payments: [{ provider: 'CASH', transactionRef: null }],
};

describe('POS order Trash', () => {
  it('deleting a completed sale undoes it (return) and marks it for re-apply', async () => {
    const { svc, tx, ret } = make(sale);
    expect(await svc.deleteSale(4, 5, 7)).toEqual({ deleted: true, undone: true });
    expect(ret).toHaveBeenCalledWith(4, 5, 7, 'Deleted from Order Manager');
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { deletedAt: expect.any(Date), posVoidedByDelete: true },
    });
  });

  it('deleting an already-returned sale just trashes it', async () => {
    const { svc, tx, ret } = make({ ...sale, status: 'RETURNED' });
    await svc.deleteSale(4, 5, 7);
    expect(ret).not.toHaveBeenCalled();
    expect(tx.order.update.mock.calls[0][0].data.posVoidedByDelete).toBe(false);
  });

  it('restoring a sale that delete undid sells it again: stock out, money booked', async () => {
    const { svc, tx, stock, salesPosting } = make({
      ...sale, status: 'RETURNED', deletedAt: new Date(), posVoidedByDelete: true,
    });
    await svc.restoreSale(4, 5, 7);
    expect(tx.order.updateMany.mock.calls[0][0]).toEqual({
      where: { id: 5, status: 'RETURNED', deletedAt: { not: null } },
      data: { status: 'COMPLETED', returnedAt: null, deletedAt: null, posVoidedByDelete: false },
    });
    expect(stock.move).toHaveBeenCalledWith(tx, expect.objectContaining({ type: 'SALE', qty: -2, storeId: 4, productId: 9 }));
    expect(tx.payment.updateMany).toHaveBeenCalledWith({ where: { orderId: 5 }, data: { status: 'CAPTURED', refundedAmount: null } });
    expect(salesPosting.postPrepaidCapture).toHaveBeenCalledWith(expect.objectContaining({ orderId: 5, amount: D(360), accountId: 11 }));
  });

  it('refuses to restore twice', async () => {
    const m = make({ ...sale, status: 'RETURNED', deletedAt: new Date(), posVoidedByDelete: true });
    m.tx.order.updateMany.mockResolvedValue({ count: 0 });
    await expect(m.svc.restoreSale(4, 5, 7)).rejects.toThrow(/already restored/);
    expect(m.salesPosting.postPrepaidCapture).not.toHaveBeenCalled();
  });

  it('the daily purge removes only undone POS sales 30+ days in the Trash', async () => {
    const { svc, prisma } = make(sale);
    const now = new Date('2026-10-30T00:00:00Z');
    expect(await svc.purgeTrash(now)).toEqual({ purged: 1 });
    const where = prisma.client.order.findMany.mock.calls[0][0].where;
    expect(where).toEqual({
      channel: 'POS',
      deletedAt: { lt: new Date('2026-09-30T00:00:00Z') },
      status: { not: 'COMPLETED' },
    });
    expect(prisma.client.order.delete).toHaveBeenCalledWith({ where: { id: 5 } });
  });
});
