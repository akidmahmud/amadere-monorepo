// CLAUDE.net-profit.ADDENDUM.md §A — the vendor plugin calls one
// proprietary aggregator (`netpls.adsmarketers.com`) we don't have access
// to and can't reuse. Made source-agnostic instead: `FraudSource` is the
// swap point. `SteadfastFraudSource` (Option 1 — keep independence, no
// hardcoded third-party vendor) is the only real implementation right now,
// wrapping the already-proven `SteadfastCourierProvider.fraudCheck()` call
// rather than duplicating it. A future BD courier-fraud aggregator plugs in
// behind this same interface without FraudService's scoring logic changing.
export interface FraudSourceResult {
  total: number;
  delivered: number;
  cancelled: number;
  byCourier?: Record<string, { total: number; delivered: number; cancelled: number }>;
}

export type FraudSourceOutcome = FraudSourceResult | { unavailable: true };

export interface FraudSource {
  readonly name: string;
  check(phoneMsisdn: string): Promise<FraudSourceOutcome>;
}
