import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { SmsService } from './sms.service';
import { ORDER_CREATED_EVENT, ORDER_STATUS_CHANGED_EVENT } from '../../orders/orders.events';
import type { OrderCreatedEvent, OrderStatusChangedEvent } from '../../orders/orders.events';

// Auto-fires the two triggers this backend already knows about server-side
// (§7.4) — same "subscribe to existing domain events" shape as B11's
// AnalyticsEventListener. Locale defaults to EN: Customer has no stored
// language preference to read (confirmed against the real schema before
// building this), so "customer's language or store default" always
// resolves to the store default here.
@Injectable()
export class SmsEventListener {
  constructor(
    private readonly sms: SmsService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent(ORDER_CREATED_EVENT)
  async onOrderCreated(event: OrderCreatedEvent): Promise<void> {
    const order = await this.orderWithPhone(event.orderId);
    if (!order?.phone) return;
    await this.sms.sendTemplate('order_placed', order.phone, 'EN', {
      orderNumber: order.orderNumber,
      amount: order.totalAmount.toString(),
    });
  }

  @OnEvent(ORDER_STATUS_CHANGED_EVENT)
  async onOrderStatusChanged(event: OrderStatusChangedEvent): Promise<void> {
    const templateKey = event.to === 'CONFIRMED' ? 'order_confirmed' : event.to === 'COMPLETED' ? 'order_delivered' : null;
    if (!templateKey) return;

    const order = await this.orderWithPhone(event.orderId);
    if (!order?.phone) return;
    await this.sms.sendTemplate(templateKey, order.phone, 'EN', { orderNumber: order.orderNumber });
  }

  private async orderWithPhone(orderId: number) {
    const order = await this.prisma.client.order.findUnique({
      where: { id: orderId },
      include: { addresses: { where: { type: 'SHIPPING' }, take: 1 } },
    });
    if (!order) return null;
    return { orderNumber: order.orderNumber, totalAmount: order.totalAmount, phone: order.addresses[0]?.phone };
  }
}
