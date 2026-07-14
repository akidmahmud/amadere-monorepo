import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsBalanceResult, SmsProvider, SmsSendResult } from '../sms-provider.interface';

const BASE_URL = 'http://bulksmsbd.net/api/smsapi';
const BALANCE_URL = 'http://bulksmsbd.net/api/getBalanceApi';

interface BulkSmsBdResponse {
  response_code?: number;
  message_id?: string;
  error_message?: string;
  success_message?: string;
}

interface BulkSmsBdBalanceResponse {
  response_code?: number;
  balance?: number;
  error_message?: string;
}

// Bulk SMS BD (bulksmsbd.net) — default Net Profit SMS gateway (spec §7.4).
// Same lazy-credential pattern as Steadfast/Payment: reads
// BULK_SMS_BD_API_KEY/BULK_SMS_BD_SENDER_ID inside the call, not the
// constructor, so the app boots fine with neither set — only an actual send
// attempt needs them. Never throws; failures resolve `{ failed: true }`.
//
// `getBalance()` targets Bulk SMS BD's documented `getBalanceApi` endpoint —
// unlike Steadfast's fraud_check (confirmed live with real credentials),
// this gateway's real key hasn't been provided in this environment, so the
// endpoint shape is taken from Bulk SMS BD's own published docs, not
// independently verified against a live account. It degrades to
// `{ unavailable: true }` the same honest way on any failure, so a wrong
// guess here just shows "unavailable" rather than crashing anything.
@Injectable()
export class BulkSmsBdProvider implements SmsProvider {
  readonly name = 'bulk_sms_bd';
  private readonly logger = new Logger(BulkSmsBdProvider.name);

  constructor(private readonly config: ConfigService) {}

  async send(to: string, body: string, senderId?: string): Promise<SmsSendResult> {
    const apiKey = this.config.get<string>('BULK_SMS_BD_API_KEY');
    const resolvedSenderId = senderId ?? this.config.get<string>('BULK_SMS_BD_SENDER_ID');
    if (!apiKey || !resolvedSenderId) {
      return { failed: true, error: 'Bulk SMS BD is not configured (missing API key/sender ID)' };
    }

    try {
      const url = new URL(BASE_URL);
      url.searchParams.set('api_key', apiKey);
      url.searchParams.set('type', 'text');
      url.searchParams.set('number', to.replace(/^\+/, ''));
      url.searchParams.set('senderid', resolvedSenderId);
      url.searchParams.set('message', body);

      const res = await fetch(url.toString());
      const json = (await res.json().catch(() => ({}))) as BulkSmsBdResponse;

      if (res.ok && json.response_code === 202) {
        return { id: json.message_id };
      }
      return { failed: true, error: json.error_message ?? `HTTP ${res.status}` };
    } catch (err) {
      this.logger.warn(`Bulk SMS BD send failed for ${to}: ${err instanceof Error ? err.message : String(err)}`);
      return { failed: true, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  async getBalance(): Promise<SmsBalanceResult> {
    const apiKey = this.config.get<string>('BULK_SMS_BD_API_KEY');
    if (!apiKey) return { unavailable: true };

    try {
      const url = new URL(BALANCE_URL);
      url.searchParams.set('api_key', apiKey);
      const res = await fetch(url.toString());
      const json = (await res.json().catch(() => ({}))) as BulkSmsBdBalanceResponse;
      if (res.ok && typeof json.balance === 'number') {
        return { balance: json.balance };
      }
      return { unavailable: true };
    } catch (err) {
      this.logger.warn(`Bulk SMS BD balance check failed: ${err instanceof Error ? err.message : String(err)}`);
      return { unavailable: true };
    }
  }
}
