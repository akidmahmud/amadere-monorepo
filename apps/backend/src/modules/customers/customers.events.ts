// Same pattern as orders.events.ts — a name plus its payload shape, so
// emitters and listeners cannot drift.

/**
 * A brand-new customer record exists.
 *
 * Deliberately NOT emitted by the CSV bulk import: importing an existing
 * customer list would otherwise fire a welcome SMS at every one of them at
 * once, which is both a real bill and a spam complaint waiting to happen.
 * Enrolling an imported batch on purpose is what the admin "enqueue" endpoint
 * is for.
 */
export const CUSTOMER_CREATED_EVENT = 'customer.created';

export interface CustomerCreatedEvent {
  customerId: number;
  /** Where the record came from, for listeners that care. */
  source: 'ADMIN' | 'REGISTRATION' | 'ORDER';
}
