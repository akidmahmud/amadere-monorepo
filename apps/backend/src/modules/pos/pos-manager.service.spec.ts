import { Prisma } from '@amader/db';
import { PosManagerService } from './pos-manager.service';

const D = (n: number) => new Prisma.Decimal(n);

function make() {
  const order = {
    findMany: jest.fn().mockResolvedValue([
      {
        id: 1, orderNumber: 'ORD-1', createdAt: new Date(), status: 'COMPLETED',
        subTotal: D(100), discountAmount: D(0), taxAmount: D(15), totalAmount: D(115),
        store: { id: 4, name: 'Uttara' },
        customer: { firstName: 'Karim', lastName: null, phone: '01711111111' },
        assignedAdmin: { firstName: 'Rahim', lastName: 'U' },
        items: [{ quantity: 2 }, { quantity: 1 }],
        payments: [{ provider: 'BKASH' }],
      },
    ]),
    count: jest.fn().mockResolvedValue(1),
    groupBy: jest.fn().mockResolvedValue([
      { status: 'COMPLETED', _count: { _all: 3 } },
      { status: 'RETURNED', _count: { _all: 1 } },
    ]),
  };
  return { svc: new PosManagerService({ client: { order } } as never, { getTiers: async () => [], stats: async () => [] } as never), order };
}

describe('PosManagerService.orders', () => {
  it('only POS sales, scoped to the store, with every filter', async () => {
    const { svc, order } = make();
    await svc.orders(4, {
      status: 'COMPLETED', tender: 'MOBILE', from: '2026-09-01', to: '2026-09-02', q: '0171',
    });
    const where = order.findMany.mock.calls[0][0].where;
    expect(where).toEqual(
      expect.objectContaining({
        channel: 'POS',
        storeId: 4,
        status: 'COMPLETED',
        payments: { some: { provider: 'BKASH' } },
        createdAt: expect.objectContaining({ gte: expect.any(Date), lt: expect.any(Date) }),
        OR: expect.any(Array),
      }),
    );
    // Tab counts ignore the status filter but keep the rest.
    expect(order.groupBy.mock.calls[0][0].where.status).toBeUndefined();
    expect(order.groupBy.mock.calls[0][0].where.storeId).toBe(4);
  });

  it('all stores when scope is null; rows carry customer, cashier, item count, tender', async () => {
    const { svc, order } = make();
    const r = await svc.orders(null, {});
    expect(order.findMany.mock.calls[0][0].where.storeId).toBeUndefined();
    expect(r.items[0]).toEqual(
      expect.objectContaining({
        customer: { name: 'Karim', phone: '01711111111' },
        cashier: 'Rahim U',
        itemCount: 3,
        tender: 'BKASH',
      }),
    );
    expect(r.counts).toEqual({ ALL: 4, COMPLETED: 3, RETURNED: 1 });
  });
});

describe('PosManagerService.customers', () => {
  it('counts completed till purchases only and lists the stores', async () => {
    const order = {
      groupBy: jest
        .fn()
        .mockResolvedValueOnce([
          { customerId: 7, _count: { _all: 2 }, _sum: { totalAmount: D(500) }, _max: { createdAt: new Date('2026-09-20') } },
        ])
        .mockResolvedValueOnce([{ customerId: 7 }])
        .mockResolvedValueOnce([{ customerId: 7, storeId: 4 }, { customerId: 7, storeId: 5 }]),
    };
    const prisma = {
      client: {
        order,
        customer: { findMany: jest.fn().mockResolvedValue([{ id: 7, firstName: 'Karim', lastName: null, phone: '017', email: null }]) },
        store: { findMany: jest.fn().mockResolvedValue([{ id: 4, name: 'Uttara' }, { id: 5, name: 'Mirpur' }]) },
      },
    };
    const r = await new PosManagerService(prisma as never, { getTiers: async () => [], stats: async () => [] } as never).customers(null, {});
    expect(order.groupBy.mock.calls[0][0].where).toEqual(
      expect.objectContaining({ channel: 'POS', status: 'COMPLETED', customerId: { not: null } }),
    );
    expect(r.items[0]).toEqual(
      expect.objectContaining({ name: 'Karim', purchases: 2, spent: '500.00', stores: ['Uttara', 'Mirpur'] }),
    );
    expect(r.total).toBe(1);
  });
});
