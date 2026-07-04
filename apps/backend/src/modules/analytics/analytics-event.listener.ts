import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AnalyticsService } from './analytics.service';
import { ORDER_CREATED_EVENT } from '../orders/orders.events';
import type { OrderCreatedEvent } from '../orders/orders.events';
import { CUSTOMER_REGISTERED_EVENT } from '../auth/auth.events';
import type { CustomerRegisteredEvent } from '../auth/auth.events';

// Auto-forwards the two business events analytics providers care about
// most (purchase revenue, sign-ups) using data this backend already knows
// server-side — everything else (page_view, view_item, add_to_cart, ...)
// only the frontend knows the timing of, so those come through
// POST /analytics/events instead (AnalyticsController).
@Injectable()
export class AnalyticsEventListener {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent(ORDER_CREATED_EVENT)
  async onOrderCreated(event: OrderCreatedEvent): Promise<void> {
    const order = await this.prisma.client.order.findUnique({
      where: { id: event.orderId },
      include: { items: true },
    });
    if (!order) return;

    await this.analytics.track({
      name: 'purchase',
      clientId: event.customerId ? `customer-${event.customerId}` : undefined,
      params: {
        transaction_id: order.orderNumber,
        currency: order.currency,
        value: Number(order.totalAmount),
        items: order.items.map((item) => ({
          item_name: item.productNameSnapshot,
          price: Number(item.unitPrice),
          quantity: item.quantity,
        })),
      },
    });
  }

  @OnEvent(CUSTOMER_REGISTERED_EVENT)
  async onCustomerRegistered(event: CustomerRegisteredEvent): Promise<void> {
    await this.analytics.track({
      name: 'sign_up',
      clientId: `customer-${event.customerId}`,
      params: {},
    });
  }
}
