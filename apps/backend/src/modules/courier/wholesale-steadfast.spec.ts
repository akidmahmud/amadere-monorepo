import { Prisma } from '@amader/db';
import { ShipmentsService } from './shipments.service';

const D = (n: number) => new Prisma.Decimal(n);

// Wholesale orders with courier Steadfast are booked through the API and show
// in Shipments tagged Wholesale.
function make(order: Record<string, unknown> = {}) {
  const wsOrder = {
    id: 3,
    orderNumber: 'WS-20261017-0001',
    customerName: 'Rahim Store',
    customerPhone: '01711111111',
    status: 'PENDING',
    courier: 'STEADFAST',
    due: '1500.00',
    note: null,
    delivery: {
      recipientName: 'Rahim',
      recipientPhone: '01722222222',
      alternativePhone: null,
      recipientEmail: null,
      addressLine: 'Shop 4, Kawran Bazar',
      district: 'Dhaka',
      thana: 'Tejgaon',
      landmark: null,
      postCode: null,
    },
    items: [{ productId: 9, variantId: null, quantity: 10, sku: 'MUS-1L', name: 'Mustard oil' }],
    ...order,
  };
  const prisma = {
    client: {
      shipment: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn((a: { data: Record<string, unknown> }) => Promise.resolve({ id: 50, ...a.data, events: [] })),
        update: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      wholesaleOrder: { update: jest.fn(), updateMany: jest.fn() },
      product: { findUnique: jest.fn().mockResolvedValue({ shippableWeight: D(1) }) },
      order: { findUnique: jest.fn() },
    },
  };
  const steadfast = {
    createConsignment: jest.fn().mockResolvedValue({
      success: true,
      consignmentId: '777',
      trackingCode: 'SF777',
      requestPayload: {},
      rawResponse: {},
    }),
  };
  const wholesale = { findOrder: jest.fn().mockResolvedValue(wsOrder) };
  const orders = { updateStatus: jest.fn() };
  const svc = new ShipmentsService(
    prisma as never, {} as never, orders as never, {} as never, {} as never,
    {} as never, steadfast as never, {} as never, {} as never, wholesale as never,
  );
  return { svc, prisma, steadfast, orders };
}

describe('Steadfast for wholesale orders', () => {
  it('books the order: COD = what the shop owes, parcel saved against the wholesale order', async () => {
    const { svc, prisma, steadfast } = make();
    await svc.dispatchWholesale(3, 1);
    const req = steadfast.createConsignment.mock.calls[0][0];
    expect(req).toMatchObject({
      invoiceNumber: 'WS-20261017-0001',
      recipientName: 'Rahim',
      recipientPhone: '01722222222',
      recipientAddress: 'Shop 4, Kawran Bazar, Tejgaon, Dhaka',
      itemDescription: 'MUS-1L x10',
    });
    expect(req.codAmount).toEqual(D(1500));
    expect(req.weightKg).toEqual(D(10));
    expect(prisma.client.shipment.create.mock.calls[0][0].data).toMatchObject({
      wholesaleOrderId: 3,
      provider: 'STEADFAST',
      status: 'DISPATCHED',
      trackingCode: 'SF777',
    });
    expect(prisma.client.wholesaleOrder.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { consignmentId: 'SF777', status: 'PROCESSING' },
    });
  });

  it('refuses another courier, a cancelled order, a missing address, or a second booking', async () => {
    await expect(make({ courier: 'SUNDARBAN' }).svc.dispatchWholesale(3, 1)).rejects.toThrow(/not Steadfast/);
    await expect(make({ status: 'CANCELLED' }).svc.dispatchWholesale(3, 1)).rejects.toThrow(/cancelled/);
    await expect(
      make({ delivery: { recipientPhone: null, addressLine: null } }).svc.dispatchWholesale(3, 1),
    ).rejects.toThrow(/phone and address/);
    const { svc, prisma } = make();
    prisma.client.shipment.findFirst.mockResolvedValue({ id: 1 });
    await expect(svc.dispatchWholesale(3, 1)).rejects.toThrow(/already booked/);
  });

  it('courier "delivered" marks the wholesale order delivered and touches no retail order', async () => {
    const { svc, prisma, orders } = make();
    prisma.client.shipment.findFirst.mockResolvedValue({
      id: 50, orderId: null, wholesaleOrderId: 3, provider: 'STEADFAST', status: 'DISPATCHED',
      billedCharge: null, deliveredAt: null, createdAt: new Date(),
    });
    await svc.handleCourierWebhook('STEADFAST', 'SF777', 'delivered', { status: 'delivered' });
    expect(prisma.client.wholesaleOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 3, status: { in: ['PENDING', 'PROCESSING'] } },
      data: { status: 'DELIVERED' },
    });
    expect(orders.updateStatus).not.toHaveBeenCalled();
    expect(prisma.client.order.findUnique).not.toHaveBeenCalled();
  });
});

describe('Shipments queue with wholesale parcels', () => {
  it('merges wholesale parcels in date order, tagged with their channel, and counts both', async () => {
    const { svc, prisma } = make();
    const retail = (id: number, day: number) => ({
      id, orderNumber: `ORD-${id}`, createdAt: new Date(2026, 9, day), status: 'PROCESSING',
      totalAmount: D(500), addresses: [], payments: [], shipments: [],
    });
    Object.assign(prisma.client.order, {
      findMany: jest.fn().mockResolvedValue([retail(1, 17), retail(2, 15)]),
      count: jest.fn().mockResolvedValue(2),
    });
    Object.assign(prisma.client.wholesaleOrder, {
      findMany: jest.fn().mockResolvedValue([{
        id: 3, orderNumber: 'WS-1', createdAt: new Date(2026, 9, 16), status: 'PROCESSING',
        recipientName: null, recipientPhone: null, total: D(1500),
        party: { name: 'Rahim Store', phone: '01711111111' },
        salesChannel: { name: 'Daraz' },
        shipments: [{ id: 50, provider: 'STEADFAST', status: 'DISPATCHED', consignmentId: '777', trackingCode: 'SF777', codAmount: D(1500), rawResponse: null }],
      }]),
      count: jest.fn().mockResolvedValue(1),
    });
    const res = await svc.adminQueue(1, 25);
    expect(res.items.map((r) => r.orderNumber)).toEqual(['ORD-1', 'WS-1', 'ORD-2']);
    expect(res.total).toBe(3);
    expect(res.items[1]).toMatchObject({
      recipientName: 'Rahim Store',
      wholesale: { channel: 'Daraz' },
      shipment: { id: 50, trackingCode: 'SF777' },
    });
  });
});

describe('Removing wholesale parcels from Shipments', () => {
  it('deletes only those wholesale orders\' shipment rows', async () => {
    const { svc, prisma } = make();
    expect(await svc.removeWholesaleShipments([3, 4])).toEqual({ removed: 2 });
    expect(prisma.client.shipment.deleteMany).toHaveBeenCalledWith({ where: { wholesaleOrderId: { in: [3, 4] } } });
  });
});
