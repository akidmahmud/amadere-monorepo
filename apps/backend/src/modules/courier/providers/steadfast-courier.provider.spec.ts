import { Prisma } from '@amader/db';
import { SteadfastCourierProvider } from './steadfast-courier.provider';

describe('SteadfastCourierProvider.createConsignment', () => {
  it('books an Exchange order (৳0 total) with COD 0, not blank or refused', async () => {
    const provider = new SteadfastCourierProvider({} as never, {} as never);
    // No real call: the HTTP layer is replaced.
    const request = jest
      .spyOn(
        provider as unknown as { request: (...a: unknown[]) => Promise<unknown> },
        'request',
      )
      .mockResolvedValue({
        body: { status: 200, consignment: { consignment_id: 1, tracking_code: 'T1', status: 'in_review' } },
      } as never);

    const r = await provider.createConsignment({
      invoiceNumber: 'ORD-60',
      recipientName: 'Karim',
      recipientPhone: '8801711111111',
      recipientAddress: 'Road 1, Mirpur, Dhaka',
      codAmount: new Prisma.Decimal(0),
    });

    const payload = request.mock.calls[0][2] as { cod_amount: number };
    expect(payload.cod_amount).toBe(0);
    expect(r.success).toBe(true);
  });
});
