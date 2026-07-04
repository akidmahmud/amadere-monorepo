// Other modules (courier dispatch in B7, customer notifications, Phase 2
// CRM) subscribe to these instead of being called directly (AGENTS.md §7).
export const ORDER_CREATED_EVENT = 'order.created';
export const ORDER_STATUS_CHANGED_EVENT = 'order.status_changed';

export interface OrderCreatedEvent {
  orderId: number;
  customerId: number | null;
}

export interface OrderStatusChangedEvent {
  orderId: number;
  from: string;
  to: string;
}
