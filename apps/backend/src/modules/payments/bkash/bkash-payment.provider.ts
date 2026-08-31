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
  // Seconds. bKash issues ~1h tokens; treated as a hint with a safety margin
  // rather than trusted exactly (see CachedToken below).
  expires_in?: number | string;
}

interface CachedToken {
  token: string;
  expiresAt: number;
  // Cache key: a credential rotation or a live/sandbox switch must not keep
  // serving a token minted for the old ones.
  fingerprint: string;
}

// Renew this long before bKash's own expiry, so an in-flight checkout can
// never be the request that discovers the token just died.
const TOKEN_SAFETY_MARGIN_MS = 5 * 60 * 1000;
const TOKEN_FALLBACK_TTL_MS = 50 * 60 * 1000;

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
  // In-process only, deliberately: a token is cheap to re-mint, and a shared
  // cache would be a new piece of infrastructure to get wrong. Worst case
  // after a restart or on a second instance is one extra grant call.
  private cachedToken: CachedToken | null = null;

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

  // Cached between payments. The reference implementation grants a fresh
  // token per payment, which puts TWO sequential round trips to bKash inside
  // the checkout request the customer is waiting on — the reported "takes too
  // long to reach the bKash page". Reusing a still-valid token removes one of
  // them from almost every checkout.
  async grantToken(): Promise<string> {
    const { appKey, appSecretKey, username, password } =
      await this.credentials();
    const baseUrl = await this.baseUrl();
    const fingerprint = `${baseUrl}|${appKey}|${username}`;
    const cached = this.cachedToken;
    if (cached && cached.fingerprint === fingerprint && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    const res = await fetch(`${baseUrl}/tokenized/checkout/token/grant`, {
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
      // A rejected grant invalidates whatever is cached: the credentials may
      // have just been rotated or revoked.
      this.cachedToken = null;
      throw new ServiceUnavailableException(
        `bKash token grant failed: ${body.statusMessage ?? `HTTP ${res.status}`}`,
      );
    }

    const ttlSeconds = Number(body.expires_in);
    const ttlMs =
      Number.isFinite(ttlSeconds) && ttlSeconds > 0
        ? ttlSeconds * 1000
        : TOKEN_FALLBACK_TTL_MS;
    this.cachedToken = {
      token: body.id_token,
      // max(0, …) so an absurdly short expires_in yields "already stale"
      // rather than a negative timestamp that caches forever.
      expiresAt: Date.now() + Math.max(0, ttlMs - TOKEN_SAFETY_MARGIN_MS),
      fingerprint,
    };
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
