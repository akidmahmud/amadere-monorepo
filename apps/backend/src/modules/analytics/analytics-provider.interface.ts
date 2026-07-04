export interface AnalyticsEvent {
  name: string; // e.g. 'purchase', 'sign_up', 'add_to_cart' (GA4-style)
  params: Record<string, unknown>;
  clientId?: string; // frontend-generated anonymous id (GA4 client_id, Meta fbp, ...)
  userId?: string; // authenticated customer id, if known
}

// Unlike Payment/Courier providers, send() never throws — a slow or
// misconfigured analytics vendor must never break the request that
// triggered it (checkout, registration, ...). Each implementation checks
// its own config and no-ops silently if unconfigured (AGENTS.md §6: "emit/
// forward events; keys via config").
export interface AnalyticsProvider {
  readonly name: string;
  send(event: AnalyticsEvent): Promise<void>;
}
