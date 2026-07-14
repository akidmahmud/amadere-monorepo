import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OrderStatus } from '@amader/db';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { SmsService } from './sms.service';
import { ORDER_CREATED_EVENT, ORDER_STATUS_CHANGED_EVENT } from '../../orders/orders.events';
import type { OrderCreatedEvent, OrderStatusChangedEvent } from '../../orders/orders.events';

// Status -> named-template map, each gated by its own admin toggle
// (SmsSettings.statusTriggers) — CONFIRMED/COMPLETED are on by default
// (matches the previous hardcoded behavior); PROCESSING (order_shipped) is
// new and off by default since it needs a real courier/tracking value to
// be useful. No template exists yet for CANCELED/PARTIALLY_RETURNED/
// RETURNED/HOLD, so those aren't offered here.
const STATUS_TEMPLATES: Partial<Record<OrderStatus, { key: string; triggerField: 'CONFIRMED' | 'PROCESSING' | 'COMPLETED' }>> = {
  CONFIRMED: { key: 'order_confirmed', triggerField: 'CONFIRMED' },
  PROCESSING: { key: 'order_shipped', triggerField: 'PROCESSING' },
  COMPLETED: { key: 'order_delivered', triggerField: 'COMPLETED' },
};

// Auto-fires the triggers this backend already knows about server-side
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
    const mapping = STATUS_TEMPLATES[event.to as OrderStatus];
    if (!mapping) return;

    const settings = await this.sms.getSettings();
    if (!settings.statusTriggers[mapping.triggerField]) return;

    const order = await this.orderWithPhone(event.orderId);
    if (!order?.phone) return;

    if (mapping.key === 'order_shipped') {
      const shipment = await this.prisma.client.shipment.findFirst({
        where: { orderId: event.orderId },
        orderBy: { createdAt: 'desc' },
      });
      await this.sms.sendTemplate('order_shipped', order.phone, 'EN', {
        orderNumber: order.orderNumber,
        courier: shipment?.provider ?? 'our courier partner',
        trackingUrl: shipment?.trackingCode ?? '',
      });
      return;
    }

    await this.sms.sendTemplate(mapping.key, order.phone, 'EN', { orderNumber: order.orderNumber });
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
