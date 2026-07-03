// Domain events other modules (and Phase 2 systems, e.g. CRM/loyalty) subscribe
// to via @OnEvent(...) — never call those systems directly from here (AGENTS.md §7).
export const CUSTOMER_REGISTERED_EVENT = 'customer.registered';
export const ADMIN_LOGGED_IN_EVENT = 'admin.logged_in';

export interface CustomerRegisteredEvent {
  customerId: number;
}

export interface AdminLoggedInEvent {
  adminUserId: number;
}
