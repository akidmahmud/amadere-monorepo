import { ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { BkashPaymentProvider } from './bkash-payment.provider';
import { BkashSettingsService } from './bkash-settings.service';

// bKash reports failure with a statusCode string in an HTTP 200 body, so
// every one of these paths has to be checked on the body, never on res.ok.
const CREDS = {
  username: 'u',
  password: 'p',
  appKey: 'app-key',
  appSecretKey: 'app-secret',
};

function makeProvider(opts: { creds?: typeof CREDS | null; live?: boolean } = {}) {
  const settings = {
    getCredentials: jest.fn().mockResolvedValue(
      opts.creds === undefined ? CREDS : opts.creds,
    ),
    isLiveMode: jest.fn().mockResolvedValue(opts.live ?? false),
  } as unknown as BkashSettingsService;
  const config = { get: jest.fn().mockReturnValue('https://api.example.com') } as never;
  return new BkashPaymentProvider(config, settings);
}

function mockFetch(...responses: unknown[]) {
  const fn = jest.fn();
  for (const body of responses) {
    fn.mockResolvedValueOnce({ status: 200, json: async () => body });
  }
  global.fetch = fn as never;
  return fn;
}

describe('BkashPaymentProvider', () => {
  afterEach(() => jest.restoreAllMocks());

  it('authorizes by granting a token then creating a payment', async () => {
    const fetchMock = mockFetch(
      { statusCode: '0000', id_token: 'tok-123' },
      { statusCode: '0000', paymentID: 'PAY-1', bkashURL: 'https://bkash/pay/PAY-1' },
    );
    const provider = makeProvider();

    const result = await provider.authorize(42, new Prisma.Decimal('1500.00'));

    expect(result).toEqual({
      status: 'PENDING',
      transactionRef: 'PAY-1',
      redirectUrl: 'https://bkash/pay/PAY-1',
      rawResponse: expect.objectContaining({ paymentID: 'PAY-1' }),
    });

    const [grantUrl, grantInit] = fetchMock.mock.calls[0];
    expect(grantUrl).toBe(
      'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/token/grant',
    );
    expect(JSON.parse(grantInit.body)).toEqual({
      app_key: 'app-key',
      app_secret: 'app-secret',
    });

    const [createUrl, createInit] = fetchMock.mock.calls[1];
    expect(createUrl).toBe(
      'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/create',
    );
    expect(createInit.headers).toMatchObject({
      Authorization: 'tok-123',
      'X-APP-Key': 'app-key',
    });
    expect(JSON.parse(createInit.body)).toMatchObject({
      mode: '0011',
      intent: 'sale',
      currency: 'BDT',
      amount: '1500',
      merchantInvoiceNumber: 'ORDER-42',
    });
  });

  it('uses the live host only in live mode', async () => {
    const fetchMock = mockFetch(
      { statusCode: '0000', id_token: 't' },
      { statusCode: '0000', paymentID: 'P', bkashURL: 'https://bkash/pay/P' },
    );
    await makeProvider({ live: true }).authorize(1, new Prisma.Decimal('10'));
    expect(String(fetchMock.mock.calls[0][0])).toContain('tokenized.pay.bka.sh');
  });

  it('rounds the amount — bKash rejects fractional taka on create', async () => {
    const fetchMock = mockFetch(
      { statusCode: '0000', id_token: 't' },
      { statusCode: '0000', paymentID: 'P', bkashURL: 'https://bkash/pay/P' },
    );
    await makeProvider().authorize(7, new Prisma.Decimal('1499.60'));
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).amount).toBe('1500');
  });

  it('refuses to authorize when the credentials are incomplete', async () => {
    mockFetch();
    await expect(
      makeProvider({ creds: null }).authorize(1, new Prisma.Decimal('100')),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('treats a non-0000 grant as a failure even though bKash answers HTTP 200', async () => {
    mockFetch({ statusCode: '0001', statusMessage: 'Invalid App Key' });
    await expect(
      makeProvider().authorize(1, new Prisma.Decimal('100')),
    ).rejects.toThrow(/Invalid App Key/);
  });

  it('treats a non-0000 create as a failure', async () => {
    mockFetch(
      { statusCode: '0000', id_token: 't' },
      { statusCode: '2001', statusMessage: 'Invalid amount' },
    );
    await expect(
      makeProvider().authorize(1, new Prisma.Decimal('100')),
    ).rejects.toThrow(/Invalid amount/);
  });

  it('executes a payment against the paymentID from the callback', async () => {
    const fetchMock = mockFetch(
      { statusCode: '0000', id_token: 't' },
      { statusCode: '0000', trxID: 'TRX9', paymentID: 'PAY-1' },
    );
    const result = await makeProvider().executePayment('PAY-1');
    expect(result.trxID).toBe('TRX9');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/tokenized/checkout/execute');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ paymentID: 'PAY-1' });
  });
});
