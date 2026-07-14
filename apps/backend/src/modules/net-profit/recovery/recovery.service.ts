import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@amader/db';
import { PaginatedResult } from '@amader/shared';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { paginationArgs, toPaginatedResult } from '../../../common/pagination.util';
import { NetProfitSettingsService } from '../settings/net-profit-settings.service';
import { SmsService } from '../sms/sms.service';
import { CartCampaignsService } from '../cart-campaigns/cart-campaigns.service';
import { CART_UPDATED_EVENT } from '../../cart/cart.events';
import type { CartUpdatedEvent } from '../../cart/cart.events';
import { ORDER_CREATED_EVENT } from '../../orders/orders.events';
import type { OrderCreatedEvent } from '../../orders/orders.events';
import { IncompleteOrderDto, toIncompleteOrderDto } from './recovery.mapper';

const SETTINGS_NAMESPACE = 'recovery';

export interface RecoverySettings {
  enabled: boolean;
  delayHours: number;
  maxAttempts: number;
  quietHoursStart: number; // 0-23, server-local
  quietHoursEnd: number;
}

const RECOVERY_SETTINGS_DEFAULTS: RecoverySettings = {
  enabled: false,
  delayHours: 2,
  maxAttempts: 3,
  quietHoursStart: 22,
  quietHoursEnd: 8,
};

// Captures via the existing `cart.updated` domain event — flagged as
// exactly this feature's hook since B5 (AGENTS.md: "PHASE 2 HOOK: abandoned-
// cart recovery ... via the cart.updated domain event"). Only captures the
// "cart" stage for now (the storefront doesn't yet emit a distinct
// checkout/payment-stage signal before an order completes) — a real,
// honest scope note, not a fake stage value.
@Injectable()
export class RecoveryService {
  private readonly logger = new Logger(RecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: NetProfitSettingsService,
    private readonly sms: SmsService,
    private readonly config: ConfigService,
    private readonly campaigns: CartCampaignsService,
  ) {}

  async getSettings(): Promise<RecoverySettings> {
    return this.settings.getNamespace(SETTINGS_NAMESPACE, RECOVERY_SETTINGS_DEFAULTS);
  }

  async updateSettings(dto: Partial<RecoverySettings>): Promise<RecoverySettings> {
    await this.settings.setNamespace(SETTINGS_NAMESPACE, dto);
    return this.getSettings();
  }

  @OnEvent(CART_UPDATED_EVENT)
  async onCartUpdated(event: CartUpdatedEvent): Promise<void> {
    const cart = await this.prisma.client.cart.findUnique({
      where: { id: event.cartId },
      include: {
        items: { include: { product: { include: { translations: { where: { locale: 'EN' }, take: 1 } } } } },
        customer: true,
      },
    });
    if (!cart || cart.items.length === 0) return;

    const subtotal = cart.items.reduce((sum, i) => sum.plus(i.unitPriceSnapshot.times(i.quantity)), new Prisma.Decimal(0));
    const snapshot = cart.items.map((i) => ({
      productId: i.productId,
      name: i.product.translations[0]?.name ?? i.product.slug,
      quantity: i.quantity,
      unitPrice: i.unitPriceSnapshot.toString(),
    }));

    const existing = await this.prisma.client.incompleteOrder.findUnique({ where: { cartId: cart.id } });
    if (existing) {
      await this.prisma.client.incompleteOrder.update({
        where: { cartId: cart.id },
        data: { cart: snapshot, subtotal, lastSeenAt: new Date() },
      });
      return;
    }

    const created = await this.prisma.client.incompleteOrder.create({
      data: {
        cartId: cart.id,
        customerId: cart.customerId,
        phone: cart.customer?.phone,
        email: cart.customer?.email,
        cart: snapshot,
        subtotal,
        stage: 'cart',
      },
    });
    // ADDENDUM §C2 — enqueue campaign steps once, at first capture, not on
    // every subsequent cart edit (scheduledAt is relative to *this*
    // moment, the real abandonment point).
    await this.campaigns.enqueueForIncomplete(created.id);
  }

  // Best-effort match: a completed order's shipping phone or the logged-in
  // customerId against an outstanding IncompleteOrder — exact for
  // logged-in customers, phone-based for guests (no other link exists
  // between a guest cart and a guest checkout).
  @OnEvent(ORDER_CREATED_EVENT)
  async onOrderCreated(event: OrderCreatedEvent): Promise<void> {
    const order = await this.prisma.client.order.findUnique({
      where: { id: event.orderId },
      include: { addresses: { where: { type: 'SHIPPING' }, take: 1 } },
    });
    if (!order) return;
    const phone = order.addresses[0]?.phone;

    const candidate = await this.prisma.client.incompleteOrder.findFirst({
      where: {
        recovered: false,
        OR: [
          event.customerId ? { customerId: event.customerId } : undefined,
          phone ? { phone } : undefined,
        ].filter((c): c is NonNullable<typeof c> => c !== undefined),
      },
      orderBy: { lastSeenAt: 'desc' },
    });
    if (!candidate) return;

    await this.prisma.client.incompleteOrder.update({
      where: { id: candidate.id },
      data: { recovered: true, recoveredOrderId: order.id },
    });
    // ADDENDUM §C2 stop condition — a recovered order cancels the rest of
    // that cart's scheduled campaign steps.
    await this.campaigns.skipRemaining(candidate.id);
  }

  async list(page: number, pageSize: number, recovered?: boolean): Promise<PaginatedResult<IncompleteOrderDto>> {
    const where = recovered !== undefined ? { recovered } : {};
    const [items, total] = await Promise.all([
      this.prisma.client.incompleteOrder.findMany({ where, orderBy: { lastSeenAt: 'desc' }, ...paginationArgs(page, pageSize) }),
      this.prisma.client.incompleteOrder.count({ where }),
    ]);
    return toPaginatedResult(items.map(toIncompleteOrderDto), total, page, pageSize);
  }

  async recoveryRate(): Promise<{ total: number; recovered: number; ratePercent: number; recoveredValue: string }> {
    const [total, recoveredRows] = await Promise.all([
      this.prisma.client.incompleteOrder.count(),
      this.prisma.client.incompleteOrder.findMany({ where: { recovered: true }, select: { subtotal: true } }),
    ]);
    const recoveredValue = recoveredRows.reduce((sum, r) => sum.plus(r.subtotal), new Prisma.Decimal(0));
    return {
      total,
      recovered: recoveredRows.length,
      ratePercent: total > 0 ? Number(((recoveredRows.length / total) * 100).toFixed(1)) : 0,
      recoveredValue: recoveredValue.toString(),
    };
  }

  async sendRecovery(id: number): Promise<void> {
    const row = await this.prisma.client.incompleteOrder.findUniqueOrThrow({ where: { id } });
    if (!row.phone) {
      this.logger.warn(`IncompleteOrder #${id} has no phone — cannot send recovery SMS`);
      return;
    }
    const resumeUrl = `${this.config.get<string>('STOREFRONT_BASE_URL') ?? ''}/cart`;
    await this.sms.sendTemplate('recovery', row.phone, 'EN', { resumeUrl });
    await this.prisma.client.incompleteOrder.update({
      where: { id },
      data: { recoveryAttempts: { increment: 1 } },
    });
  }

  // Hourly sweep — finds rows stale past `delayHours` with attempts left,
  // skips outside the configured quiet-hours window (checked against
  // server-local time; deferred to the next hourly tick, not dropped).
  @Cron(CronExpression.EVERY_HOUR)
  async sweep(): Promise<void> {
    const settings = await this.getSettings();
    if (!settings.enabled) return;

    const hour = new Date().getHours();
    const inQuietHours =
      settings.quietHoursStart < settings.quietHoursEnd
        ? hour >= settings.quietHoursStart && hour < settings.quietHoursEnd
        : hour >= settings.quietHoursStart || hour < settings.quietHoursEnd;
    if (inQuietHours) return;

    const cutoff = new Date(Date.now() - settings.delayHours * 60 * 60 * 1000);
    const stale = await this.prisma.client.incompleteOrder.findMany({
      where: {
        recovered: false,
        phone: { not: null },
        lastSeenAt: { lt: cutoff },
        recoveryAttempts: { lt: settings.maxAttempts },
      },
    });

    for (const row of stale) {
      await this.sendRecovery(row.id);
    }
    if (stale.length > 0) this.logger.log(`Recovery sweep sent ${stale.length} SMS`);
  }
}
