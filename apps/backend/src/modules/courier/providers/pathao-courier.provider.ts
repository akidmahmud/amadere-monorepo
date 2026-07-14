import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  CancelReturnResult,
  CourierProvider,
  CreateConsignmentInput,
  CreateConsignmentResult,
  TrackResult,
} from '../courier-provider.interface';
import { CourierSettingsService } from '../courier-settings.service';

const LIVE_BASE_URL = 'https://api-hermes.pathao.com';
const SANDBOX_BASE_URL = 'https://courier-api-sandbox.pathao.com';

interface PathaoTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  message?: string;
}

interface PathaoApiResponse {
  code?: number;
  message?: string;
  data?: Record<string, unknown>;
  errors?: Record<string, string[]>;
}

// Real Pathao Merchant API client (OAuth2 password grant) — endpoint shapes
// and payload fields ported from the reference plugin's working integration
// (class-wpfok-courier-pathao.php / class-wpfok-courier-manager.php), not
// guessed from generic docs. Token is cached in-memory per process (this
// provider is a singleton) instead of WP transients, refreshed 5 minutes
// before real expiry.
@Injectable()
export class PathaoCourierProvider implements CourierProvider {
  private cachedToken: { accessToken: string; refreshToken: string; expiresAt: number } | null = null;

  constructor(private readonly settings: CourierSettingsService) {}

  private async baseUrl(): Promise<string> {
    const config = await this.settings.getPathaoConfig();
    return config.environment === 'sandbox' ? SANDBOX_BASE_URL : LIVE_BASE_URL;
  }

  private async getAccessToken(forceRefresh = false): Promise<string> {
    const now = Date.now();
    if (!forceRefresh && this.cachedToken && this.cachedToken.expiresAt > now + 5 * 60 * 1000) {
      return this.cachedToken.accessToken;
    }

    const creds = await this.settings.getPathaoCredentials();
    if (!creds.clientId || !creds.clientSecret || !creds.username || !creds.password) {
      throw new ServiceUnavailableException('Pathao credentials are not configured');
    }

    const base = await this.baseUrl();
    const res = await fetch(`${base}/aladdin/api/v1/issue-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        grant_type: 'password',
        username: creds.username,
        password: creds.password,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as PathaoTokenResponse;
    if (!res.ok || !body.access_token || !body.expires_in) {
      throw new BadGatewayException(body.message ?? `Pathao token request failed (HTTP ${res.status})`);
    }

    this.cachedToken = {
      accessToken: body.access_token,
      refreshToken: body.refresh_token ?? '',
      expiresAt: now + body.expires_in * 1000,
    };
    return this.cachedToken.accessToken;
  }

  private async request(method: string, path: string, body?: unknown): Promise<PathaoApiResponse> {
    const token = await this.getAccessToken();
    const base = await this.baseUrl();
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as PathaoApiResponse;

    if (res.status === 401) this.cachedToken = null;
    if (!res.ok) {
      const fieldErrors = data.errors ? Object.values(data.errors).flat().join(' | ') : undefined;
      throw new BadGatewayException(fieldErrors || data.message || `Pathao API request failed (HTTP ${res.status})`);
    }
    return data;
  }

  async createConsignment(input: CreateConsignmentInput): Promise<CreateConsignmentResult> {
    const payload = {
      store_id: input.pathao?.storeId ?? 0,
      merchant_order_id: input.invoiceNumber,
      recipient_name: input.recipientName,
      recipient_phone: input.recipientPhone,
      recipient_address: input.recipientAddress,
      delivery_type: 48,
      item_type: 2,
      special_instruction: input.note ?? '',
      item_quantity: 1,
      item_weight: input.weightKg ? input.weightKg.toString() : '0.5',
      item_description: input.itemDescription ?? '',
      amount_to_collect: Math.round(Number(input.codAmount)),
      ...(input.pathao?.recipientCity ? { recipient_city: input.pathao.recipientCity } : {}),
      ...(input.pathao?.recipientZone ? { recipient_zone: input.pathao.recipientZone } : {}),
      ...(input.pathao?.recipientArea ? { recipient_area: input.pathao.recipientArea } : {}),
    };

    try {
      const response = await this.request('POST', '/aladdin/api/v1/orders', payload);
      const data = response.data ?? {};
      const consignmentId = String(data.consignment_id ?? '');
      const success = (response.code === 200 || response.code === 201) && consignmentId !== '';
      return {
        success,
        consignmentId: success ? consignmentId : undefined,
        rawStatus: success ? String(data.order_status ?? '') : undefined,
        errorMessage: success ? undefined : (response.message ?? 'Pathao rejected the consignment'),
        requestPayload: payload,
        rawResponse: response,
      };
    } catch (err) {
      return {
        success: false,
        errorMessage: err instanceof Error ? err.message : 'Pathao dispatch failed',
        requestPayload: payload,
        rawResponse: null,
      };
    }
  }

  async track(consignmentId: string): Promise<TrackResult> {
    const response = await this.request('GET', `/aladdin/api/v1/orders/${encodeURIComponent(consignmentId)}/info`);
    const data = response.data ?? {};
    return {
      rawStatus: String(data.order_status ?? data.order_status_slug ?? 'unknown'),
      rawResponse: response,
    };
  }

  async cancelOrReturn(_consignmentId: string, reasonCode: string): Promise<CancelReturnResult> {
    await Promise.resolve();
    return {
      success: true,
      note: `Pathao has no cancel/return API in this integration — recorded locally only (reason: ${reasonCode}). Cancel via the Pathao merchant portal.`,
      rawResponse: null,
    };
  }

  // Location cascade endpoints, used by the admin consign modal.
  async getStores(): Promise<unknown[]> {
    const response = await this.request('GET', '/aladdin/api/v1/stores');
    const data = response.data as { data?: unknown[] } | unknown[] | undefined;
    return Array.isArray(data) ? data : (data?.data ?? []);
  }

  async getCities(): Promise<unknown[]> {
    const response = await this.request('GET', '/aladdin/api/v1/city-list');
    const data = response.data as { data?: unknown[] } | unknown[] | undefined;
    return Array.isArray(data) ? data : (data?.data ?? []);
  }

  async getZones(cityId: number): Promise<unknown[]> {
    const response = await this.request('GET', `/aladdin/api/v1/cities/${cityId}/zone-list`);
    const data = response.data as { data?: unknown[] } | unknown[] | undefined;
    return Array.isArray(data) ? data : (data?.data ?? []);
  }

  async getAreas(zoneId: number): Promise<unknown[]> {
    const response = await this.request('GET', `/aladdin/api/v1/zones/${zoneId}/area-list`);
    const data = response.data as { data?: unknown[] } | unknown[] | undefined;
    return Array.isArray(data) ? data : (data?.data ?? []);
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.getAccessToken(true);
      return { success: true, message: 'Connected successfully! Token obtained.' };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Connection failed' };
    }
  }
}
