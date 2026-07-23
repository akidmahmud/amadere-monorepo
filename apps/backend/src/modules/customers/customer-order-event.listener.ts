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

  // Every order (guest or logged-in) ends up linked to a Customer, and that
  // Customer's admin-list "Address" column comes from CustomerAddress — a
  // separate profile-managed table checkout never used to touch. Result:
  // every brand-new customer (guest or first-time logged-in) showed no
  // address at all until they separately visited their account and added
  // one, which most people never do straight after checking out. Fixed by
  // always backfilling a default CustomerAddress from the order's shipping
  // address on a customer's very first order (existing customers with an
  // address already on file are left alone — this doesn't overwrite a
  // chosen default on every repeat order with a different delivery spot).
  @OnEvent(ORDER_CREATED_EVENT)
  async onOrderCreated(event: OrderCreatedEvent): Promise<void> {
    const order = await this.prisma.client.order.findUnique({
      where: { id: event.orderId },
      include: { addresses: { where: { type: 'SHIPPING' }, take: 1 } },
    });
    const address = order?.addresses[0];

    let customerId = event.customerId;
    if (!customerId) {
      if (!address?.phone) return;
      const [firstName, ...rest] = address.recipientName.trim().split(/\s+/);
      const customer = await this.prisma.client.customer.upsert({
        where: { phone: address.phone },
        update: {},
        create: {
          phone: address.phone,
          email: address.email ?? undefined,
          firstName: firstName || address.recipientName,
          lastName: rest.length ? rest.join(' ') : null,
        },
      });
      customerId = customer.id;
      await this.prisma.client.order.update({
        where: { id: event.orderId },
        data: { customerId },
      });
    }

    if (address) {
      const hasAddress = await this.prisma.client.customerAddress.findFirst({ where: { customerId } });
      if (!hasAddress) {
        await this.prisma.client.customerAddress.create({
          data: {
            customerId,
            recipientName: address.recipientName,
            phone: address.phone,
            division: address.division,
            district: address.district,
            area: address.area,
            landmark: address.landmark,
            addressLine: address.addressLine,
            postCode: address.postCode,
            isDefault: true,
          },
        });
      }
    }
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
