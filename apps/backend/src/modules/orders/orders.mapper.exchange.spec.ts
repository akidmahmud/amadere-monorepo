import { Prisma } from '@amader/db';
import { toOrderDto } from './orders.mapper';

const D = (n: number) => new Prisma.Decimal(n);

// Just enough of an order for toOrderDto; the exchange links are under test.
function order(over: Record<string, unknown>) {
  return {
    id: 60, orderNumber: 'ORD-60', customerId: null, status: 'CONFIRMED', channel: 'PHONE',
    assignedAdminId: null, assignedAdmin: null,
    subTotal: D(0), discountAmount: D(0), taxAmount: D(0), codFee: D(0), shippingAmount: D(0), totalAmount: D(0),
    currency: 'BDT', couponCode: null, shippingMethod: null, customerNote: null, staffNote: null,
    cancelReason: null, codVerifiedAt: null, confirmedAt: null, completedAt: null, canceledAt: null,
    createdAt: new Date(), ipAddress: null, utmSource: null, utmMedium: null, utmCampaign: null,
    landingDomain: null, landingPage: null, referrerUrl: null, referrerDomain: null,
    items: [], addresses: [], statusHistory: [], payments: [], shipments: [],
    exchangeOf: null, exchanges: [],
    ...over,
  } as never;
}

describe('toOrderDto — exchange links', () => {
  it('an exchange order points to its original', () => {
    const dto = toOrderDto(order({ exchangeOf: { id: 50, orderNumber: 'ORD-50' } }));
    expect(dto.exchangeOf).toEqual({ id: 50, orderNumber: 'ORD-50' });
  });

  it('an original lists its exchanges', () => {
    const dto = toOrderDto(order({ exchanges: [{ id: 60, orderNumber: 'ORD-60' }] }));
    expect(dto.exchanges).toEqual([{ id: 60, orderNumber: 'ORD-60' }]);
    expect(toOrderDto(order({})).exchangeOf).toBeNull();
  });
});

describe('toOrderDto — stockBackOnShelf', () => {
  const h = (...st: string[]) => st.map((status, i) => ({ status, note: null, createdAt: new Date(2026, 0, i + 1), adminUser: null }));

  it('true after a return when the order was not completed again', () => {
    const dto = toOrderDto(order({ status: 'PROCESSING', completedAt: new Date(), statusHistory: h('COMPLETED', 'RETURNED', 'PROCESSING') }));
    expect(dto.stockBackOnShelf).toBe(true);
  });

  it('false while the stock is out (completed, or never delivered)', () => {
    expect(toOrderDto(order({ status: 'COMPLETED', completedAt: new Date(), statusHistory: h('COMPLETED') })).stockBackOnShelf).toBe(false);
    expect(toOrderDto(order({ status: 'PROCESSING', completedAt: null, statusHistory: h('PROCESSING') })).stockBackOnShelf).toBe(false);
    expect(
      toOrderDto(order({ status: 'COMPLETED', completedAt: new Date(), statusHistory: h('COMPLETED', 'RETURNED', 'COMPLETED') })).stockBackOnShelf,
    ).toBe(false);
  });
});
