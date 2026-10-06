import { SmsEventListener } from './sms-event.listener';

describe('SmsEventListener.onWholesaleOrderCreated', () => {
  const sent: { key: string; params: Record<string, unknown> }[] = [];
  const sms = {
    sendTemplate: jest.fn(async (key: string, _to: string, _l: string, params: Record<string, unknown>) => {
      sent.push({ key, params });
      return null;
    }),
  };
  const listener = new SmsEventListener(sms as never, {} as never);
  const base = {
    orderId: 1,
    orderNumber: 'WS-1',
    customerName: 'Rahim',
    customerPhone: '01700000000',
    total: '500',
    due: '0',
  };
  beforeEach(() => (sent.length = 0));

  it('Wholesale / Cash Sale (channel null) → wholesale_order_placed', async () => {
    await listener.onWholesaleOrderCreated({ ...base, channel: null });
    expect(sent[0].key).toBe('wholesale_order_placed');
  });

  it('another channel → channel_order_placed naming it', async () => {
    await listener.onWholesaleOrderCreated({ ...base, channel: 'Daraz' });
    expect(sent[0]).toMatchObject({ key: 'channel_order_placed', params: { channel: 'Daraz' } });
  });

  it('no phone → nothing sent', async () => {
    await listener.onWholesaleOrderCreated({ ...base, customerPhone: null, channel: 'Daraz' });
    expect(sent).toHaveLength(0);
  });
});
