export interface SmsSendResult {
  id?: string;
  cost?: number;
  failed?: boolean;
  error?: string;
  // Raw gateway response code (e.g. Bulk SMS BD's 202/1001/1007/...) plus
  // the decoded human-readable reason, when the provider exposes one —
  // surfaced in SmsLog.meta so the admin log table can explain a failure
  // instead of showing a bare numeric code.
  code?: number;
  codeMessage?: string;
}

export type SmsBalanceResult = { balance: number } | { unavailable: true };

// Config-driven, one implementation swappable for another (spec §7.4) —
// default is Bulk SMS BD; mirrors CourierProvider/PaymentProvider's
// deferred-credentials shape (AGENTS.md §7). Never throws: an unconfigured
// or failed send resolves `{ failed: true, error }` so callers (SmsService)
// can log FAILED and move on rather than crashing whatever triggered it
// (an order status change, a checkout).
export interface SmsProvider {
  readonly name: string;
  send(to: string, body: string, senderId?: string): Promise<SmsSendResult>;
  // ADDENDUM §H — optional since not every gateway exposes one.
  getBalance?(): Promise<SmsBalanceResult>;
}
