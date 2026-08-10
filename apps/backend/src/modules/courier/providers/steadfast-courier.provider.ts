import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { normalizeBdPhone } from '@amader/shared';
import {
  BalanceOutcome,
  CancelReturnResult,
  CourierProvider,
  CreateConsignmentInput,
  CreateConsignmentResult,
  FraudCheckOutcome,
  TrackResult,
} from '../courier-provider.interface';
import { CourierSettingsService } from '../courier-settings.service';

interface SteadfastConsignment {
  consignment_id?: number | string;
  tracking_code?: string;
  status?: string;
}

interface SteadfastResponse {
  status?: number;
  message?: string;
  consignment?: SteadfastConsignment;
  delivery_status?: string;
}

// Verified against the real, live endpoint (not the official docs, which
// don't list this endpoint at all): no `status`/`message`/`phone` wrapper,
// just these four fields directly. `total_parcels` isn't always exactly
// `total_delivered + total_cancelled` (parcels can be in-transit/pending),
// so it's used as-is rather than derived.
interface SteadfastFraudCheckResponse {
  total_parcels?: number;
  total_delivered?: number;
  total_cancelled?: number;
  total_fraud_reports?: unknown[];
}

// Verified against the reference codebase's working integration: no
// `message` field on success, just `{ status: 200, current_balance }`.
interface SteadfastBalanceResponse {
  status?: number;
  current_balance?: number;
}

const BASE_URL = 'https://portal.packzy.com/api/v1';

// Steadfast wants the local 11-digit shape (01XXXXXXXXX) on every phone
// field, regardless of how it's stored internally (this app's site-wide
// storage format is 880XXXXXXXXXX, see packages/shared/src/phone.ts) —
// normalizeBdPhone() handles any input shape (already-local, +880, 880,
// spaces) and returns a clean +8801XXXXXXXXX, then this just drops the
// leading '+880' for '0'. Falls back to the raw input if it doesn't even
// look like a BD number, so a bad value still gets sent (and Steadfast's
// own validation rejects it with a real error) rather than silently vanishing.
function toLocalPhone(phone: string): string {
  const normalized = normalizeBdPhone(phone);
  return normalized ? '0' + normalized.slice(4) : phone;
}

// Real implementation — endpoints, payload shape and auth headers verified
// against the reference codebase's working integration (public_html
// platform/plugins/steadfast), not guessed from generic docs. Steadfast's
// public API has no cancel/return endpoint (merchants use their portal for
// that), so cancelOrReturn() below is a local-only, honest no-op call.
@Injectable()
export class SteadfastCourierProvider implements CourierProvider {
  private readonly logger = new Logger(SteadfastCourierProvider.name);

  constructor(
    private readonly config: ConfigService,
    private readonly settings: CourierSettingsService,
  ) {}

  async createConsignment(
    input: CreateConsignmentInput,
  ): Promise<CreateConsignmentResult> {
    const payload = {
      invoice: input.invoiceNumber,
      recipient_name: input.recipientName,
      // Steadfast expects the local 11-digit shape (01XXXXXXXXX), not this
      // app's site-wide storage format (880XXXXXXXXXX, see phoneLookupCandidates
      // elsewhere) — same conversion fraudCheck() already does below, applied
      // here too since this call site never had it (recipient_phone was
      // being sent 13-digit, which Steadfast's real API rejects/mishandles).
      recipient_phone: toLocalPhone(input.recipientPhone),
      alternative_phone: input.alternativePhone ? toLocalPhone(input.alternativePhone) : '',
      recipient_email: input.recipientEmail ?? '',
      // Steadfast's documented 250-char cap on recipient_address — truncate
      // rather than let a long address get rejected outright.
      recipient_address: input.recipientAddress.slice(0, 250),
      cod_amount: Number(input.codAmount),
      note: input.note ?? '',
      item_description: input.itemDescription ?? '',
      delivery_type: input.deliveryType ?? 0,
    };

    const response = await this.request<SteadfastResponse>(
      '/create_order',
      'POST',
      payload,
    );
    const consignment = response.body?.consignment;
    const success =
      response.body?.status === 200 && !!consignment?.consignment_id;

    return {
      success,
      consignmentId: consignment?.consignment_id
        ? String(consignment.consignment_id)
        : undefined,
      trackingCode: consignment?.tracking_code,
      rawStatus: consignment?.status,
      errorMessage: success
        ? undefined
        : (response.body?.message ?? `HTTP ${response.httpStatus}`),
      requestPayload: payload,
      rawResponse: response.body,
    };
  }

  async track(consignmentId: string): Promise<TrackResult> {
    const response = await this.request<SteadfastResponse>(
      `/status_by_cid/${consignmentId}`,
      'GET',
    );
    return {
      rawStatus: response.body?.delivery_status ?? 'unknown',
      rawResponse: response.body,
    };
  }

  async cancelOrReturn(
    _consignmentId: string,
    reasonCode: string,
  ): Promise<CancelReturnResult> {
    await Promise.resolve();
    return {
      success: true,
      note: `Steadfast has no cancel/return API — recorded locally only (reason: ${reasonCode}). Cancel via the Steadfast merchant portal.`,
      rawResponse: null,
    };
  }

  // Steadfast's real "Fraud Check" endpoint — undocumented in Steadfast's
  // own published API reference, but confirmed live with real credentials:
  // `GET /fraud_check/{localPhone}` returns
  // `{ total_parcels, total_delivered, total_cancelled, total_fraud_reports }`
  // with no status/message wrapper (a real 401/404 comes through as a
  // non-200 HTTP status, not a body field — checked below). This is
  // network-wide across every merchant using Steadfast, not scoped to this
  // account, which is the whole point of a fraud-check feature. Takes the
  // local 11-digit format (matches recipient_phone elsewhere in this file),
  // not the +880 MSISDN fraud.service normalizes to internally. Never
  // throws (CLAUDE.net-profit.md §7.2/§3.4): any failure — missing
  // credentials, network error, non-200 — degrades to `{ unavailable: true }`
  // so one unreachable courier can't break the whole aggregation.
  async fraudCheck(phoneMsisdn: string): Promise<FraudCheckOutcome> {
    try {
      const localPhone = toLocalPhone(phoneMsisdn);
      const response = await this.request<SteadfastFraudCheckResponse>(
        `/fraud_check/${localPhone}`,
        'GET',
      );
      if (response.httpStatus !== 200) {
        this.logger.warn(
          `Steadfast fraud_check non-200 for ${localPhone}: HTTP ${response.httpStatus}`,
        );
        return { unavailable: true };
      }
      const delivered = response.body.total_delivered ?? 0;
      const cancelled = response.body.total_cancelled ?? 0;
      const total = response.body.total_parcels ?? delivered + cancelled;
      return { total, delivered, cancelled };
    } catch (err) {
      this.logger.warn(
        `Steadfast fraud_check failed for ${phoneMsisdn}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { unavailable: true };
    }
  }

  // Current COD-collections balance held by Steadfast for this merchant
  // account — same never-throws-on-failure contract as fraudCheck above.
  async getBalance(): Promise<BalanceOutcome> {
    try {
      const response = await this.request<SteadfastBalanceResponse>('/get_balance', 'GET');
      if (response.httpStatus !== 200 || response.body.current_balance === undefined) {
        this.logger.warn(`Steadfast get_balance non-200/missing balance: HTTP ${response.httpStatus}`);
        return { unavailable: true };
      }
      return { balance: response.body.current_balance };
    } catch (err) {
      this.logger.warn(`Steadfast get_balance failed: ${err instanceof Error ? err.message : String(err)}`);
      return { unavailable: true };
    }
  }

  // Admin-configured credentials (Couriers settings page, §Phase 2) win
  // when present; falls back to the original `.env` vars so an existing
  // working deployment never breaks just because nobody's opened the new
  // settings UI yet.
  private async credentials(): Promise<{ apiKey: string; secretKey: string }> {
    const stored = await this.settings.getSteadfastCredentials();
    const apiKey = stored.apiKey ?? this.config.get<string>('STEADFAST_API_KEY');
    const secretKey = stored.secretKey ?? this.config.get<string>('STEADFAST_SECRET_KEY');
    if (!apiKey || !secretKey) throw new ServiceUnavailableException('Steadfast credentials are not configured');
    return { apiKey, secretKey };
  }

  private async request<T>(
    path: string,
    method: string,
    body?: unknown,
  ): Promise<{ httpStatus: number; body: T }> {
    const { apiKey, secretKey } = await this.credentials();
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Api-Key': apiKey,
        'Secret-Key': secretKey,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json()) as T;
    return { httpStatus: res.status, body: json };
  }
}
