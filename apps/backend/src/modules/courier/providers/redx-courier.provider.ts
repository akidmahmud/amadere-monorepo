import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  CancelReturnResult,
  CourierProvider,
  CreateConsignmentInput,
  CreateConsignmentResult,
  TrackResult,
} from '../courier-provider.interface';
import { CourierSettingsService } from '../courier-settings.service';

const LIVE_BASE_URL = 'https://openapi.redx.com.bd/v1.0.0-beta';
const SANDBOX_BASE_URL = 'https://sandbox.redx.com.bd/v1.0.0-beta';

interface RedxApiResponse {
  tracking_id?: string;
  message?: string;
  error?: string | { message?: string };
  errors?: Record<string, string[]>;
  areas?: unknown[];
  pickup_stores?: unknown[];
  parcel?: { status?: string };
}

// Real RedX OpenAPI client — endpoint shapes and payload fields ported from
// the reference plugin's working integration (class-wpfok-courier-redx.php
// / class-wpfok-courier-manager.php). Single bearer token, no OAuth dance.
@Injectable()
export class RedxCourierProvider implements CourierProvider {
  constructor(private readonly settings: CourierSettingsService) {}

  private async baseUrl(): Promise<string> {
    const config = await this.settings.getRedxConfig();
    return config.environment === 'sandbox' ? SANDBOX_BASE_URL : LIVE_BASE_URL;
  }

  private async request(method: string, path: string, body?: unknown, query?: Record<string, string | number>): Promise<RedxApiResponse> {
    const creds = await this.settings.getRedxCredentials();
    if (!creds.apiToken) throw new ServiceUnavailableException('RedX API token is not configured');

    const base = await this.baseUrl();
    const qs = query ? `?${new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString()}` : '';
    const res = await fetch(`${base}${path}${qs}`, {
      method,
      headers: {
        'API-ACCESS-TOKEN': `Bearer ${creds.apiToken}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as RedxApiResponse;

    if (!res.ok) {
      const fieldErrors = data.errors ? Object.values(data.errors).flat().join(' | ') : undefined;
      const errMsg = typeof data.error === 'object' ? data.error?.message : data.error;
      throw new BadGatewayException(fieldErrors || data.message || errMsg || `RedX API request failed (HTTP ${res.status})`);
    }
    return data;
  }

  async createConsignment(input: CreateConsignmentInput): Promise<CreateConsignmentResult> {
    if (!input.redx?.deliveryAreaId) {
      return {
        success: false,
        errorMessage: 'RedX requires a delivery area to be selected',
        requestPayload: null,
        rawResponse: null,
      };
    }

    const payload = {
      customer_name: input.recipientName,
      customer_phone: input.recipientPhone,
      customer_address: input.recipientAddress,
      merchant_invoice_id: input.invoiceNumber,
      cash_collection_amount: Math.round(Number(input.codAmount)).toString(),
      parcel_weight: input.weightKg ? input.weightKg.times(1000).toString() : '500',
      instruction: input.note ?? '',
      value: '0',
      is_closed_box: false,
      delivery_area_id: input.redx.deliveryAreaId,
      ...(input.redx.pickupStoreId ? { pickup_store_id: input.redx.pickupStoreId } : {}),
    };

    try {
      const response = await this.request('POST', '/parcel', payload);
      const success = !!response.tracking_id;
      return {
        success,
        consignmentId: success ? response.tracking_id : undefined,
        trackingCode: success ? response.tracking_id : undefined,
        errorMessage: success ? undefined : (response.message ?? 'RedX rejected the parcel'),
        requestPayload: payload,
        rawResponse: response,
      };
    } catch (err) {
      return {
        success: false,
        errorMessage: err instanceof Error ? err.message : 'RedX dispatch failed',
        requestPayload: payload,
        rawResponse: null,
      };
    }
  }

  async track(consignmentId: string): Promise<TrackResult> {
    const response = await this.request('GET', `/parcel/info/${encodeURIComponent(consignmentId)}`);
    return {
      rawStatus: response.parcel?.status ?? 'unknown',
      rawResponse: response,
    };
  }

  async cancelOrReturn(_consignmentId: string, reasonCode: string): Promise<CancelReturnResult> {
    await Promise.resolve();
    return {
      success: true,
      note: `RedX has no cancel/return API in this integration — recorded locally only (reason: ${reasonCode}). Cancel via the RedX merchant portal.`,
      rawResponse: null,
    };
  }

  // Location endpoints, used by the admin consign modal.
  async getAreas(): Promise<unknown[]> {
    const response = await this.request('GET', '/areas');
    return response.areas ?? [];
  }

  async getPickupStores(): Promise<unknown[]> {
    const response = await this.request('GET', '/pickup/stores');
    return response.pickup_stores ?? [];
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.request('GET', '/areas');
      return { success: true, message: 'Connected successfully! Token verified.' };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Connection failed' };
    }
  }
}
