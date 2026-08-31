import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@amader/db';
import {
  AuthorizeResult,
  PaymentProvider,
  RefundResult,
} from '../payment-provider.interface';
import { BkashSettingsService } from './bkash-settings.service';

const LIVE_BASE = 'https://tokenized.pay.bka.sh/v1.2.0-beta';
const SANDBOX_BASE = 'https://tokenized.sandbox.bka.sh/v1.2.0-beta';

// bKash signals success with the string '0000' in `statusCode`, not with the
// HTTP status — a failed grant/create/execute still comes back HTTP 200.
const SUCCESS = '0000';

interface GrantTokenResponse {
  statusCode?: string;
  statusMessage?: string;
  id_token?: string;
}

interface CreatePaymentResponse {
  statusCode?: string;
  statusMessage?: string;
  paymentID?: string;
  bkashURL?: string;
}

export interface ExecutePaymentResponse {
  statusCode?: string;
  statusMessage?: string;
  paymentID?: string;
  trxID?: string;
  amount?: string;
  transactionStatus?: string;
}

// bKash Tokenized Checkout (Checkout URL). Endpoints, header names, the
// `mode: '0011'` create payload and the '0000' success convention are taken
// from the reference codebase's working integration
// (public_html/platform/plugins/bkashpay), not guessed from generic docs —
// same approach that got the Steadfast provider right.
//
// Flow: authorize() grants a token and creates a payment, handing back
// bKash's hosted `bkashURL` as `redirectUrl`; the customer pays there;
// bKash redirects to our callback, which calls execute() to capture.
@Injectable()
export class BkashPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(BkashPaymentProvider.name);

  constructor(
    private readonly config: ConfigService,
    private readonly settings: BkashSettingsService,
  ) {}

  private async baseUrl(): Promise<string> {
    return (await this.settings.isLiveMode()) ? LIVE_BASE : SANDBOX_BASE;
  }

  private async credentials() {
    const creds = await this.settings.getCredentials();
    if (!creds)
      throw new ServiceUnavailableException('bKash is not fully configured');
    return creds;
  }

  // bKash tokens are short-lived; the reference grants a fresh one per
  // payment rather than caching, which is one fewer thing to get wrong and
  // costs one extra call on a flow that already redirects the customer.
  async grantToken(): Promise<string> {
    const { appKey, appSecretKey, username, password } =
      await this.credentials();
    const res = await fetch(`${await this.baseUrl()}/tokenized/checkout/token/grant`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        username,
        password,
      },
      body: JSON.stringify({ app_key: appKey, app_secret: appSecretKey }),
    });
    const body = (await res.json()) as GrantTokenResponse;
    if (body.statusCode !== SUCCESS || !body.id_token) {
      throw new ServiceUnavailableException(
        `bKash token grant failed: ${body.statusMessage ?? `HTTP ${res.status}`}`,
      );
    }
    return body.id_token;
  }

  // Admin "Test credentials": does bKash accept the stored credential set on
  // the currently selected environment? Never throws — the whole point is to
  // hand the admin bKash's own rejection message instead of making them place
  // a real order to find out, which is exactly how the first failure here was
  // discovered.
  async testCredentials(): Promise<{
    ok: boolean;
    environment: 'live' | 'sandbox';
    message: string;
  }> {
    const environment = (await this.settings.isLiveMode()) ? 'live' : 'sandbox';
    try {
      await this.grantToken();
      return { ok: true, environment, message: 'bKash accepted these credentials.' };
    } catch (err) {
      return {
        ok: false,
        environment,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async authHeaders(token: string) {
    const { appKey } = await this.credentials();
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: token,
      'X-APP-Key': appKey,
    };
  }

  async authorize(
    orderId: number,
    amount: Prisma.Decimal,
  ): Promise<AuthorizeResult> {
    const token = await this.grantToken();
    const callbackBase =
      this.config.get<string>('API_BASE_URL') ?? 'http://localhost:3000';
    // bKash rejects fractional amounts on this endpoint; orders are whole
    // taka in practice, and rounding down would silently undercharge, so
    // round to nearest like the reference does.
    const payload = {
      mode: '0011',
      amount: String(Math.round(Number(amount))),
      currency: 'BDT',
      intent: 'sale',
      payerReference: String(orderId),
      callbackURL: `${callbackBase}/api/v1/payments/bkash/callback`,
      merchantInvoiceNumber: `ORDER-${orderId}`,
    };
    const res = await fetch(`${await this.baseUrl()}/tokenized/checkout/create`, {
      method: 'POST',
      headers: await this.authHeaders(token),
      body: JSON.stringify(payload),
    });
    const body = (await res.json()) as CreatePaymentResponse;
    if (body.statusCode !== SUCCESS || !body.bkashURL || !body.paymentID) {
      throw new ServiceUnavailableException(
        `bKash create payment failed: ${body.statusMessage ?? `HTTP ${res.status}`}`,
      );
    }
    return {
      // Not money yet — the customer still has to authorise on bKash's page.
      // The callback flips this to CAPTURED once execute() confirms.
      status: 'PENDING',
      transactionRef: body.paymentID,
      redirectUrl: body.bkashURL,
      rawResponse: body,
    };
  }

  // Called from the callback controller once bKash sends the customer back.
  async executePayment(paymentID: string): Promise<ExecutePaymentResponse> {
    const token = await this.grantToken();
    const res = await fetch(`${await this.baseUrl()}/tokenized/checkout/execute`, {
      method: 'POST',
      headers: await this.authHeaders(token),
      body: JSON.stringify({ paymentID }),
    });
    return (await res.json()) as ExecutePaymentResponse;
  }

  // bKash does have a refund API, but the reference integration never wired
  // it and nobody has asked for it here — refunds go back through the same
  // manual route COD uses (admin sends the money, records the outcome), so
  // this reports what actually happened rather than pretending to call an
  // endpoint that was never tested against a real merchant account.
  async refund(): Promise<RefundResult> {
    await Promise.resolve();
    this.logger.warn(
      'bKash refund recorded locally only — send the money back from the bKash merchant portal.',
    );
    return { status: 'REFUNDED' };
  }
}
