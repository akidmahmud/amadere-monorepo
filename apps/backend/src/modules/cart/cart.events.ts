// PHASE 2 HOOK: abandoned-cart recovery (CRM/marketing automation) subscribes
// to this instead of being called directly (AGENTS.md §7).
export const CART_UPDATED_EVENT = 'cart.updated';

export interface CartUpdatedEvent {
  cartId: number;
  customerId: number | null;
}
