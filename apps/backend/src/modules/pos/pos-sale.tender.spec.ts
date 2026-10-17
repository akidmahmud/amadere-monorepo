import { Prisma } from '@amader/db';
import { PosSaleService } from './pos-sale.service';
import { SalesPostingService } from '../net-profit/accounts/ledger/sales-posting.service';

const D = (n: number) => new Prisma.Decimal(n);

// A cashier picked Cash for a bKash sale: the method and the money move.
describe('POS change payment method', () => {
  function make(order: Record<string, unknown>) {
    const tx = {
      payment: { update: jest.fn() },
      order: { update: jest.fn() },
      orderStatusHistory: { create: jest.fn() },
    };
    const prisma = { client: { $transaction: (f: (t: typeof tx) => Promise<unknown>) => f(tx) } };
    const stores = { tenderAccountId: jest.fn().mockResolvedValue(22) };
    const salesPosting = { moveOrderMoney: jest.fn() };
    const svc = new PosSaleService(
      prisma as never, {} as never, stores as never, {} as never,
      salesPosting as never, {} as never, {} as never, {} as never,
    );
    jest.spyOn(svc, 'get').mockResolvedValue(order as never);
    return { svc, tx, stores, salesPosting };
  }
  const sale = { id: 5, storeId: 4, status: 'COMPLETED', deletedAt: null, payments: [{ id: 70, provider: 'CASH' }] };

  it('Cash → Mobile Banking: payment updated, money moved to the store mobile account, noted', async () => {
    const { svc, tx, stores, salesPosting } = make(sale);
    await svc.changeTender(4, 5, 'MOBILE', 7);
    expect(tx.payment.update).toHaveBeenCalledWith({ where: { id: 70 }, data: { provider: 'BKASH' } });
    expect(tx.order.update).toHaveBeenCalledWith({ where: { id: 5 }, data: { tenderedAmount: null } });
    expect(stores.tenderAccountId).toHaveBeenCalledWith(4, 'BKASH');
    expect(salesPosting.moveOrderMoney).toHaveBeenCalledWith(5, 22, 7, tx);
    expect(tx.orderStatusHistory.create.mock.calls[0][0].data.note).toBe('Payment changed: Cash → Mobile Banking');
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
