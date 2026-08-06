import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CredentialsService } from '../../../../common/credentials/credentials.service';
import { SmsBalanceResult, SmsProvider, SmsSendResult } from '../sms-provider.interface';

// Shared with SmsService (getSettings/updateSettings) so both read/write the
// exact same vault keys.
export const SMS_API_KEY_CREDENTIAL = 'sms.httpApi.apiKey';
export const SMS_SECRET_KEY_CREDENTIAL = 'sms.httpApi.secretKey';

// The vendor's docs use `<IP>:<port>` as a literal placeholder throughout —
// there's no fixed public hostname, it's assigned per account. No hardcoded
// default on purpose: send()/getBalance() fail cleanly with a clear "not
// configured" error rather than silently hitting a wrong/placeholder host.
const BASE_URL_ENV_KEY = 'SMS_HTTP_API_BASE_URL';

// Status codes for the SMS SEND API's response ("Status Codes for Submit
// response" in the vendor's API doc, SMS HTTP API v5.4.0) — ported verbatim
// so a failed send shows the real reason instead of a bare numeric code.
// Distinct from the DLR (delivery query) status codes, which reuse some of
// the same numbers for different meanings.
export const HTTP_SMS_SUBMIT_RESPONSE_CODES: Record<number, string> = {
  0: 'Accepted',
  [-1]: 'Org Client Not Found',
  [-3]: 'Invalid Dest No.',
  [-4]: 'Insufficient Balance',
  [-5]: 'Org Rate Not Found',
  [-6]: 'Org Blocked',
  [-7]: 'Invalid Sender ID',
  [-36]: 'Invalid Request Type',
  [-42]: 'Authorization Failed',
  [-44]: 'ContactNo Blocked',
  [-45]: 'ContactNo Blocked by Admin',
  [-46]: 'Dipping Failed',
  [-47]: 'Content not Whitelisted',
  [-48]: 'URL Blocked',
  [-49]: 'Content is Blocked',
  [-52]: 'License Limit Exceeded',
  [-54]: 'Sender ID Empty',
  [-55]: 'Destination ID Empty',
  [-56]: 'Message Content Empty',
  [-58]: 'HLR Request Failed',
  [-59]: 'IP Not Allowed',
  [-60]: 'Invalid Hash value',
  [-61]: 'Invalid parameter',
  [-62]: 'Internal Server Error',
  [-63]: 'Invalid Transaction ID',
  [-64]: 'Sender ID Block',
  [-65]: 'Bulk Limit Exceeded',
  [-66]: 'Invalid API Key',
  [-67]: 'Invalid Secret Key',
  [-68]: 'Duplicate Transaction ID',
};

interface HttpSmsSendResponse {
  Status?: string;
  StatusDescription?: string;
  Text?: string;
  Message_ID?: string;
}

interface HttpSmsBalanceResponse {
  statusInfo?: {
    statusCode?: string;
    errordescription?: string;
    availablebalance?: string;
  };
}

// Generic "SMS HTTP API" gateway (vendor's own published API doc, v5.4.0 —
// replaces the previous Bulk SMS BD integration, see AGENTS.md changelog).
// Same admin-editable-credentials shape as the provider it replaces: apikey
// and secretkey both live in CredentialsService's encrypted vault, sender ID
// stays a plain NetProfitSettingsService field (see SmsService). Never
// throws; failures resolve `{ failed: true }`.
//
// Only `/sendtext` (send) and `/api/v3/balance` (balance) are wired up —
// the doc also covers DLR polling/push and MO endpoints, which the current
// SmsProvider interface has no concept of yet; add them if delivery-status
// tracking becomes a real requirement.
@Injectable()
export class HttpSmsProvider implements SmsProvider {
  readonly name = 'http_sms';
  private readonly logger = new Logger(HttpSmsProvider.name);

  constructor(
    private readonly config: ConfigService,
    private readonly credentials: CredentialsService,
  ) {}

  private async getCredentials(): Promise<{ apiKey?: string; secretKey?: string; baseUrl?: string }> {
    const [apiKey, secretKey] = await Promise.all([
      this.credentials.getCredential(SMS_API_KEY_CREDENTIAL),
      this.credentials.getCredential(SMS_SECRET_KEY_CREDENTIAL),
    ]);
    return {
      apiKey: apiKey ?? undefined,
      secretKey: secretKey ?? undefined,
      baseUrl: this.config.get<string>(BASE_URL_ENV_KEY),
    };
  }

  async send(to: string, body: string, senderId?: string): Promise<SmsSendResult> {
    const { apiKey, secretKey, baseUrl } = await this.getCredentials();
    if (!apiKey || !secretKey) {
      return { failed: true, error: 'SMS HTTP API is not configured (missing API key/secret key)' };
    }
    if (!baseUrl) {
      return { failed: true, error: `SMS HTTP API base URL not configured (set ${BASE_URL_ENV_KEY})` };
    }
    if (!senderId) {
      return { failed: true, error: 'SMS HTTP API is not configured (missing sender ID / callerID)' };
    }

    try {
      const res = await fetch(`${baseUrl}/sendtext`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apikey: apiKey,
          secretkey: secretKey,
          callerID: senderId,
          toUser: to.replace(/^\+/, ''),
          messageContent: body,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as HttpSmsSendResponse;
      const code = json.Status !== undefined ? Number(json.Status) : undefined;
      const codeMessage = code !== undefined ? HTTP_SMS_SUBMIT_RESPONSE_CODES[code] : undefined;

      if (res.ok && code === 0) {
        return { id: json.Message_ID, code, codeMessage };
      }
      return {
        failed: true,
        error: json.StatusDescription || codeMessage || `HTTP ${res.status}`,
        code,
        codeMessage,
      };
    } catch (err) {
      this.logger.warn(`SMS HTTP API send failed for ${to}: ${err instanceof Error ? err.message : String(err)}`);
      return { failed: true, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  async getBalance(): Promise<SmsBalanceResult> {
    const { apiKey, secretKey, baseUrl } = await this.getCredentials();
    if (!apiKey || !secretKey || !baseUrl) return { unavailable: true };

    try {
      const res = await fetch(`${baseUrl}/api/v3/balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apikey: apiKey, secretkey: secretKey }),
      });
      const json = (await res.json().catch(() => ({}))) as HttpSmsBalanceResponse;
      const info = json.statusInfo;
      if (res.ok && info?.statusCode === '0' && info.availablebalance !== undefined) {
        const balance = Number(info.availablebalance);
        if (!Number.isNaN(balance)) return { balance };
      }
      return { unavailable: true };
    } catch (err) {
      this.logger.warn(`SMS HTTP API balance check failed: ${err instanceof Error ? err.message : String(err)}`);
      return { unavailable: true };
    }
  }
}
