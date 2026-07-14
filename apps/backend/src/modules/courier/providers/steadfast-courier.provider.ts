import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CancelReturnResult,
  CourierProvider,
  CreateConsignmentInput,
  CreateConsignmentResult,
  FraudCheckOutcome,
  TrackResult,
} from '../courier-provider.interface';

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

const BASE_URL = 'https://portal.packzy.com/api/v1';

// Real implementation — endpoints, payload shape and auth headers verified
// against the reference codebase's working integration (public_html
// platform/plugins/steadfast), not guessed from generic docs. Steadfast's
// public API has no cancel/return endpoint (merchants use their portal for
// that), so cancelOrReturn() below is a local-only, honest no-op call.
@Injectable()
export class SteadfastCourierProvider implements CourierProvider {
  private readonly logger = new Logger(SteadfastCourierProvider.name);

  constructor(private readonly config: ConfigService) {}

  async createConsignment(
    input: CreateConsignmentInput,
  ): Promise<CreateConsignmentResult> {
    const payload = {
      invoice: input.invoiceNumber,
      recipient_name: input.recipientName,
      recipient_phone: input.recipientPhone,
      recipient_address: input.recipientAddress,
      cod_amount: Number(input.codAmount),
      note: input.note ?? '',
      item_description: input.itemDescription ?? '',
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
      const localPhone = phoneMsisdn.startsWith('+880')
        ? '0' + phoneMsisdn.slice(4)
        : phoneMsisdn;
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

  private async request<T>(
    path: string,
    method: string,
    body?: unknown,
  ): Promise<{ httpStatus: number; body: T }> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Api-Key': this.config.getOrThrow<string>('STEADFAST_API_KEY'),
        'Secret-Key': this.config.getOrThrow<string>('STEADFAST_SECRET_KEY'),
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json()) as T;
    return { httpStatus: res.status, body: json };
  }
}
