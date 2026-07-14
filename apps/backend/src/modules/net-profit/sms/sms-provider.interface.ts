export interface SmsSendResult {
  id?: string;
  cost?: number;
  failed?: boolean;
  error?: string;
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
