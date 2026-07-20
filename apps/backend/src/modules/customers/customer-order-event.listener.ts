import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CustomerTiersService } from './customer-tiers.service';
import {
  ORDER_CREATED_EVENT,
  ORDER_STATUS_CHANGED_EVENT,
} from '../orders/orders.events';
import type {
  OrderCreatedEvent,
  OrderStatusChangedEvent,
} from '../orders/orders.events';

// Same "subscribe to existing domain events" shape as SmsEventListener —
// zero changes needed to checkout.service.ts or orders.service.ts, both of
// which already emit exactly what this needs.
@Injectable()
export class CustomerOrderEventListener {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tiers: CustomerTiersService,
  ) {}

  // Every order (guest or logged-in) ends up linked to a Customer. If the
  // checkout was already made by a logged-in customer, event.customerId is
  // already set — nothing to do. Otherwise, match by phone or create a new
  // Customer (no password, same as existing OTP/social-only accounts).
  @OnEvent(ORDER_CREATED_EVENT)
  async onOrderCreated(event: OrderCreatedEvent): Promise<void> {
    if (event.customerId) return;

    const order = await this.prisma.client.order.findUnique({
      where: { id: event.orderId },
      include: { addresses: { where: { type: 'SHIPPING' }, take: 1 } },
    });
    const address = order?.addresses[0];
    if (!address?.phone) return;

    const [firstName, ...rest] = address.recipientName.trim().split(/\s+/);
    const customer = await this.prisma.client.customer.upsert({
      where: { phone: address.phone },
      update: {},
      create: {
        phone: address.phone,
        firstName: firstName || address.recipientName,
        lastName: rest.length ? rest.join(' ') : null,
      },
    });

    await this.prisma.client.order.update({
      where: { id: event.orderId },
      data: { customerId: customer.id },
    });
  }

  // Only COMPLETED-related transitions can change a tier, so anything else
  // is a no-op — cheap to check before touching the DB again.
  @OnEvent(ORDER_STATUS_CHANGED_EVENT)
  async onOrderStatusChanged(event: OrderStatusChangedEvent): Promise<void> {
    if (event.from !== 'COMPLETED' && event.to !== 'COMPLETED') return;

    const order = await this.prisma.client.order.findUnique({
      where: { id: event.orderId },
      select: { customerId: true },
    });
    if (!order?.customerId) return;

    await this.tiers.recomputeForCustomer(order.customerId);
  }
}
