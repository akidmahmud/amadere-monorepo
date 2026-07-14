import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CredentialsService } from '../../../../common/credentials/credentials.service';
import { SmsBalanceResult, SmsProvider, SmsSendResult } from '../sms-provider.interface';

const BASE_URL = 'http://bulksmsbd.net/api/smsapi';
const BALANCE_URL = 'http://bulksmsbd.net/api/getBalanceApi';

// Shared with SmsService (getSettings/updateSettings) so both read/write
// the exact same vault key.
export const SMS_API_KEY_CREDENTIAL = 'sms.bulkSmsBd.apiKey';

// Bulk SMS BD's documented response_code table — ported verbatim from the
// reference plugin (class-wpfok-sms.php) rather than guessed, so a failed
// send shows the real reason instead of a bare numeric code.
export const BULK_SMS_BD_RESPONSE_CODES: Record<number, string> = {
  202: 'SMS Submitted Successfully',
  1001: 'Invalid Number',
  1002: 'Sender ID not correct or disabled',
  1003: 'Required fields missing / Contact Admin',
  1005: 'Internal Error',
  1006: 'Balance Validity Not Available',
  1007: 'Balance Insufficient',
  1011: 'User ID not found',
  1012: 'Masking SMS must be in Bengali',
  1013: 'Sender ID gateway not found',
  1014: 'Sender Type Name not found',
  1015: 'No valid gateway found',
  1016: 'Price info not found',
  1017: 'Price info not found for sender',
  1018: 'Account is disabled',
  1019: 'Price is disabled',
  1020: 'Parent account not found',
  1021: 'Parent price not found',
  1031: 'Account not verified',
  1032: 'IP not whitelisted',
};

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
// The API key is admin-editable via CredentialsService (encrypted at rest,
// same vault as courier credentials) — matching the plugin's own encrypted-
// option storage — with BULK_SMS_BD_API_KEY as a fallback for deployments
// that still set it via env only. Sender ID stays a plain (non-secret)
// NetProfitSettingsService field (see SmsService), not a credential.
// Never throws; failures resolve `{ failed: true }`.
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

  constructor(
    private readonly config: ConfigService,
    private readonly credentials: CredentialsService,
  ) {}

  private async getApiKey(): Promise<string | undefined> {
    const stored = await this.credentials.getCredential(SMS_API_KEY_CREDENTIAL);
    return stored ?? this.config.get<string>('BULK_SMS_BD_API_KEY');
  }

  async send(to: string, body: string, senderId?: string): Promise<SmsSendResult> {
    const apiKey = await this.getApiKey();
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
      const code = json.response_code;
      const codeMessage = code !== undefined ? BULK_SMS_BD_RESPONSE_CODES[code] : undefined;

      if (res.ok && code === 202) {
        return { id: json.message_id, code, codeMessage };
      }
      return { failed: true, error: json.error_message ?? codeMessage ?? `HTTP ${res.status}`, code, codeMessage };
    } catch (err) {
      this.logger.warn(`Bulk SMS BD send failed for ${to}: ${err instanceof Error ? err.message : String(err)}`);
      return { failed: true, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  async getBalance(): Promise<SmsBalanceResult> {
    const apiKey = await this.getApiKey();
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
