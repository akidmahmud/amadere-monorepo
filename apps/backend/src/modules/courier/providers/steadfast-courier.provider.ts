import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CancelReturnResult,
  CourierProvider,
  CreateConsignmentInput,
  CreateConsignmentResult,
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

const BASE_URL = 'https://portal.packzy.com/api/v1';

// Real implementation — endpoints, payload shape and auth headers verified
// against the reference codebase's working integration (public_html
// platform/plugins/steadfast), not guessed from generic docs. Steadfast's
// public API has no cancel/return endpoint (merchants use their portal for
// that), so cancelOrReturn() below is a local-only, honest no-op call.
@Injectable()
export class SteadfastCourierProvider implements CourierProvider {
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
