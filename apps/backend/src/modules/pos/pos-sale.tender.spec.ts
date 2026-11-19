import { Prisma } from '@amader/db';
import { PosSaleService } from './pos-sale.service';
import { SalesPostingService } from '../net-profit/accounts/ledger/sales-posting.service';

const D = (n: number) => new Prisma.Decimal(n);

// A cashier picked Cash for a bKash sale: the method and the money move.
describe('POS change payment method', () => {
  function make(order: Record<string, unknown>) {
    const tx = {
      payment: { update: jest.fn(), deleteMany: jest.fn(), create: jest.fn() },
      order: { update: jest.fn() },
      orderStatusHistory: { create: jest.fn() },
    };
    const prisma = { client: { $transaction: (f: (t: typeof tx) => Promise<unknown>) => f(tx) } };
    const stores = { tenderAccountId: jest.fn().mockResolvedValue(22) };
    const salesPosting = { splitOrderMoney: jest.fn() };
    const svc = new PosSaleService(
      prisma as never, {} as never, stores as never, {} as never,
      salesPosting as never, {} as never, {} as never, {} as never,
    );
    jest.spyOn(svc, 'get').mockResolvedValue(order as never);
    return { svc, tx, stores, salesPosting };
  }
  const sale = {
    id: 5, storeId: 4, status: 'COMPLETED', deletedAt: null,
    totalAmount: D(1000), posRefundedAmount: D(0),
    payments: [{ id: 70, provider: 'CASH', amount: D(1000), createdAt: new Date(5000) }],
  };

  it('Cash → Mobile Banking: payment updated, money moved to the store mobile account, noted', async () => {
    const { svc, tx, stores, salesPosting } = make(sale);
    await svc.changeTender(4, 5, 'MOBILE', 7);
    expect(tx.payment.update).toHaveBeenCalledWith({ where: { id: 70 }, data: { provider: 'BKASH', amount: D(1000) } });
    expect(tx.order.update).toHaveBeenCalledWith({ where: { id: 5 }, data: { tenderedAmount: null } });
    expect(stores.tenderAccountId).toHaveBeenCalledWith(4, 'BKASH');
    expect(salesPosting.splitOrderMoney).toHaveBeenCalledWith(5, 22, undefined, D(0), 7, tx);
    expect(tx.orderStatusHistory.create.mock.calls[0][0].data.note).toBe('Payment changed: Cash → Mobile Banking');
  });

  it('Cash → Cash ৳200 + Card: card row ৳800, cash row ৳200, ৳200 moved to the cash till', async () => {
    const { svc, tx, salesPosting } = make(sale);
    await svc.changeTender(4, 5, 'CARD', 7, 200);
    expect(tx.payment.update).toHaveBeenCalledWith({ where: { id: 70 }, data: { provider: 'CARD', amount: D(800) } });
    expect(tx.payment.create.mock.calls[0][0].data).toMatchObject({ provider: 'CASH', amount: D(200) });
    expect(salesPosting.splitOrderMoney).toHaveBeenCalledWith(5, 22, 22, D(200), 7, tx);
    expect(tx.orderStatusHistory.create.mock.calls[0][0].data.note).toBe('Payment changed: Cash → Cash ৳200.00 + Card');
    await expect(svc.changeTender(4, 5, 'CARD', 7, 1000)).rejects.toThrow(/less than the total/);
  });

  it('same method: nothing changes; a trashed sale is refused', async () => {
    const { svc, tx } = make(sale);
    await svc.changeTender(4, 5, 'CASH', 7);
    expect(tx.payment.update).not.toHaveBeenCalled();
    await expect(make({ ...sale, deletedAt: new Date() }).svc.changeTender(4, 5, 'CARD', 7)).rejects.toThrow(/Trash/);
  });
});

describe('SalesPostingService.moveOrderMoney', () => {
  it('reverses each live sale/refund entry on the old account and re-books it on the new one', async () => {
    const ledger = { reverse: jest.fn(), post: jest.fn() };
    const svc = new SalesPostingService({} as never, ledger as never, {} as never, {} as never, {} as never);
    const date = new Date('2026-10-16');
    const tx = {
      ledgerEntry: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1, entryDate: date, direction: 'IN', amount: D(720), source: 'SALE', reference: null, note: 'Order payment' },
          { id: 2, entryDate: date, direction: 'OUT', amount: D(100), source: 'REFUND', reference: null, note: 'Order refund' },
        ]),
      },
    };
    expect(await svc.moveOrderMoney(5, 22, 7, tx as never)).toBe(2);
    expect(tx.ledgerEntry.findMany.mock.calls[0][0].where).toMatchObject({
      orderId: 5, reversalOfId: null, reversedBy: { none: {} }, accountId: { not: 22 },
    });
    expect(ledger.reverse.mock.calls.map((c) => c[0])).toEqual([1, 2]);
    expect(ledger.post.mock.calls[1][0]).toMatchObject({ direction: 'OUT', amount: D(100), accountId: 22, source: 'REFUND', entryDate: date });
  });
});
