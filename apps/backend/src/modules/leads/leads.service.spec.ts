import { LeadsService, statusAfterCall } from './leads.service';
import { daysBetween, segmentOf } from './lead-dashboard.service';

describe('Lead Center', () => {
  it('a call moves the lead along: new → contacted, interested, follow-up, lost, do-not-call', () => {
    expect(statusAfterCall('NEW', 'NO_ANSWER').status).toBe('CONTACTED');
    expect(statusAfterCall('INTERESTED', 'BUSY').status).toBe('INTERESTED');
    expect(statusAfterCall('NEW', 'ANSWERED_INTERESTED').status).toBe('INTERESTED');
    expect(statusAfterCall('NEW', 'ANSWERED_CALL_BACK').status).toBe('FOLLOW_UP');
    expect(statusAfterCall('NEW', 'NOT_INTERESTED')).toEqual({ status: 'LOST', lostReason: 'Not interested' });
    expect(statusAfterCall('NEW', 'DO_NOT_CALL').status).toBe('DNC');
  });

  it('customers by last order: active under 2 months, at risk to 6, dormant after', () => {
    const now = new Date('2026-10-26T00:00:00Z');
    expect(segmentOf(new Date('2026-09-20T00:00:00Z'), now)).toBe('Active (0-2 mo)');
    expect(segmentOf(new Date('2026-06-01T00:00:00Z'), now)).toBe('At Risk (2-6 mo)');
    expect(segmentOf(new Date('2026-01-01T00:00:00Z'), now)).toBe('Dormant (6+ mo)');
    expect(daysBetween('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  });

  it('an order for a lead’s phone converts it: marked converted, empty CRM fields filled, calls moved', async () => {
    const lead = {
      id: 7, phone: '8801711111111', assignedAdminId: 3, priority: 'HIGH', nextCallDate: null,
      customerFeedback: 'wants 5 ltr', agentFeedback: null, familyDetails: null, purchaseReason: null,
      calls: [{ outcome: 'ANSWERED_INTERESTED', notes: 'price asked', authorAdminId: 3, createdAt: new Date('2026-10-20') }],
    };
    const tx = {
      lead: { update: jest.fn() },
      customer: { update: jest.fn() },
      customerCallLog: { createMany: jest.fn() },
    };
    const prisma = {
      client: {
        order: { findUnique: jest.fn().mockResolvedValue({ id: 50, customerId: 9, channel: 'WEBSITE', addresses: [{ phone: '01711111111' }] }) },
        lead: { findMany: jest.fn().mockResolvedValue([lead]) },
        customer: { findUnique: jest.fn().mockResolvedValue({ id: 9, assignedAdminId: null, priority: null, nextCallTarget: null, customerFeedback: 'old', amaderFeedback: null, familyDetails: null, purchaseReason: null }) },
        $transaction: (f: (t: typeof tx) => Promise<unknown>) => f(tx),
      },
    };
    await new LeadsService(prisma as never).onOrderCreated({ orderId: 50, customerId: 9 });
    expect(tx.lead.update.mock.calls[0][0].data).toMatchObject({ status: 'CONVERTED', convertedOrderId: 50, convertedCustomerId: 9 });
    expect(tx.customer.update.mock.calls[0][0].data).toMatchObject({ assignedAdminId: 3, priority: 'HIGH', customerFeedback: undefined });
    expect(tx.customerCallLog.createMany.mock.calls[0][0].data[0]).toMatchObject({ customerId: 9, outcome: 'CONNECTED' });
  });
});
