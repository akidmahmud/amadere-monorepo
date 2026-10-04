import { Prisma } from '@amader/db';
import { ShipmentsService } from './shipments.service';
import { SalesPostingService } from '../net-profit/accounts/ledger/sales-posting.service';
import { calcOrder } from '../net-profit/sales-report/engine/calc';
import type { ReportOrder, ReportSettings } from '../net-profit/sales-report/engine/types';

const D = (n: number) => new Prisma.Decimal(n);

// The real case: Jober Atta order ৳780 COD; the customer refused the goods
// and paid only the ৳80 delivery charge. Steadfast: "partial delivery",
// "Amount has been changed from 780 to 80", charge ৳145.
function makeShipments(orderStatus = 'CONFIRMED') {
  const shipment = {
    id: 9,
    orderId: 5,
    provider: 'STEADFAST',
    createdAt: new Date('2026-09-28'),
    deliveredAt: null,
    billedCharge: null,
    collectedCodAmount: null,
    settledCodAmount: null,
  };
  const prisma = {
    client: {
      shipment: {
        findFirst: jest.fn().mockResolvedValue(shipment),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      order: { findUnique: jest.fn().mockResolvedValue({ id: 5, status: orderStatus }) },
      payment: {
        findFirst: jest.fn().mockResolvedValue({ id: 1, provider: 'COD', status: 'PENDING' }),
        update: jest.fn(),
      },
    },
  };
  const orders = { updateStatus: jest.fn() };
  const salesPosting = { resizeCodReceivable: jest.fn() };
  const svc = new ShipmentsService(
    prisma as never,
    {} as never,
    orders as never,
    {} as never,
    {} as never,
    salesPosting as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { svc, prisma, orders, salesPosting, shipment };
}

describe('courier "partial delivery" (customer paid only the delivery charge)', () => {
  it('records what was collected and the real charge, returns the order, shrinks the receivable', async () => {
    const { svc, prisma, orders, salesPosting } = makeShipments();
    await svc.handleCourierWebhook('STEADFAST', '301436309', 'partial_delivered', {
      consignment_id: 301436309,
      status: 'partial_delivered',
      cod_amount: 80,
      delivery_charge: 145,
    });
    const data = prisma.client.shipment.update.mock.calls[0][0].data;
    expect(data.status).toBe('PARTIALLY_DELIVERED');
    expect(data.collectedCodAmount).toEqual(D(80));
    expect(data.billedCharge).toEqual(D(145));
    expect(orders.updateStatus).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ status: 'PARTIALLY_RETURNED', note: expect.stringMatching(/৳80 collected/) }),
      null,
    );
    expect(salesPosting.resizeCodReceivable).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 5, codAmount: D(80) }),
    );
  });

  it('a full return cancels the COD receivable (nothing will be paid)', async () => {
    const { svc, salesPosting } = makeShipments();
    await svc.handleCourierWebhook('STEADFAST', '1', 'returned', { status: 'returned' });
    expect(salesPosting.resizeCodReceivable.mock.calls[0][0].codAmount).toEqual(D(0));
  });

  it('Steadfast "cancelled" (not delivered, parcel returns) also cancels it', async () => {
    const { svc, salesPosting } = makeShipments();
    await svc.handleCourierWebhook('STEADFAST', '1', 'cancelled', { status: 'cancelled' });
    expect(salesPosting.resizeCodReceivable.mock.calls[0][0].codAmount).toEqual(D(0));
  });

  it('approval_pending is only the rider word: nothing settled', async () => {
    const { svc, orders, salesPosting } = makeShipments();
    await svc.handleCourierWebhook('STEADFAST', '1', 'partial_delivered_approval_pending', {
      status: 'partial_delivered_approval_pending',
      cod_amount: 80,
    });
    expect(orders.updateStatus).not.toHaveBeenCalled();
    expect(salesPosting.resizeCodReceivable).not.toHaveBeenCalled();
  });

  it('existing open orders already reported partial are caught up', async () => {
    const { svc, prisma, orders, salesPosting } = makeShipments();
    prisma.client.shipment.findMany.mockResolvedValue([
      { id: 9, orderId: 5, provider: 'STEADFAST', createdAt: new Date(), collectedCodAmount: null, settledCodAmount: D(80) },
    ]);
    expect(await svc.reconcilePartialDeliveries()).toBe(1);
    expect(orders.updateStatus.mock.calls[0][1].status).toBe('PARTIALLY_RETURNED');
    expect(salesPosting.resizeCodReceivable.mock.calls[0][0].codAmount).toEqual(D(80));
  });
});

describe('SalesPostingService.resizeCodReceivable', () => {
  function make(due: unknown, paidEntries = 0) {
    const prisma = {
      client: {
        due: { findFirst: jest.fn().mockResolvedValueOnce(due).mockResolvedValueOnce(null) },
        ledgerEntry: { count: jest.fn().mockResolvedValue(paidEntries) },
      },
    };
    const dues = { void: jest.fn(), create: jest.fn() };
    const parties = { resolveCourierParty: jest.fn().mockResolvedValue({ id: 3 }) };
    const svc = new SalesPostingService(prisma as never, {} as never, dues as never, parties as never, {} as never);
    return { svc, dues };
  }
  const input = { orderId: 5, shipmentId: 9, provider: 'STEADFAST' as const, codAmount: D(80), dispatchedAt: new Date('2026-09-28') };

  it('780 receivable → voided and re-opened at the 80 actually collected', async () => {
    const { svc, dues } = make({ id: 7, amount: D(780) });
    await svc.resizeCodReceivable(input);
    expect(dues.void).toHaveBeenCalledWith(7, null);
    expect(dues.create.mock.calls[0][0]).toMatchObject({ source: 'COD_IN_TRANSIT', amount: '80.00' });
  });

  it('left alone once any of it was settled', async () => {
    const { svc, dues } = make({ id: 7, amount: D(780) }, 1);
    await svc.resizeCodReceivable(input);
    expect(dues.void).not.toHaveBeenCalled();
  });
});

describe('sales report: a returned parcel that still paid the delivery charge', () => {
  const S: ReportSettings = { rates: {}, packaging: 15, fees: {}, th: { low: 50, over: 10, pending: 3, bill: 7 } };
  const o: ReportOrder = {
    id: 1, orderNumber: 'ORD-1', date: '2026-09-27', status: 'Returned', channel: 'Website',
    agentId: null, agentName: null, customer: '', phone: '', ctype: 'New', district: 'Dhaka', zone: 'Inside Dhaka',
    lines: [{ key: 'p1', name: 'Jober Atta 2 kg', qty: 1, price: 700, disc: 0, unitWeight: 2, unitCost: 500, costOk: true }],
    delivery: 80, payment: 'COD', advance: 0, courier: 'STEADFAST', actual: 145, hist: {}, returnCollected: 80,
  };
  it('counts ৳80 in, ৳145 courier and packaging out — not ৳780, not ৳0', () => {
    const c = calcOrder(o, S);
    expect(c.contribution).toBe(80 - 145 - 15);
    expect(c.receivable).toBe(80 - 145);
  });
});
