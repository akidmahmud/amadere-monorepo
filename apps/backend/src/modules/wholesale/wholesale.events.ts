// Other modules (SMS today) subscribe to this instead of WholesaleService
// calling them directly — same convention as orders.events.ts (AGENTS.md §7).
export const WHOLESALE_ORDER_CREATED_EVENT = 'wholesale_order.created';

export interface WholesaleOrderCreatedEvent {
  orderId: number;
  orderNumber: string;
  customerName: string;
  customerPhone: string | null;
  total: string;
  due: string;
}
