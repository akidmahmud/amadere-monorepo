import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PushService } from './push.service';

/**
 * "Notify me when this is back in stock."
 *
 * The notification is found by a SWEEP, not by a hook on stock writes. Stock
 * rises through many paths — an admin editing the field, a cancelled order
 * restocking its lines, a return, a CSV import, a wholesale reversal — and
 * hooking each one means every future path has to remember to call us. Asking
 * the opposite question on a schedule ("which waiting alerts now have stock?")
 * catches all of them with one query and cannot be forgotten.
 *
 * A few minutes' delay on a back-in-stock alert costs nothing.
 */
@Injectable()
export class StockAlertsService {
  private readonly logger = new Logger(StockAlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  /**
   * Register interest. Idempotent by (endpoint, product, variant) — pressing
   * the button twice must not queue two notifications.
   *
   * Re-registering after a previous alert was sent clears `notifiedAt`, so a
   * shopper who missed the restock and asks again gets told next time.
   */
  async register(input: {
    productId: number;
    variantId?: number | null;
    endpoint: string;
    customerId?: number | null;
    locale?: string;
  }): Promise<{ ok: true }> {
    const existing = await this.prisma.client.stockAlert.findFirst({
      where: {
        endpoint: input.endpoint,
        productId: input.productId,
        variantId: input.variantId ?? null,
      },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.client.stockAlert.update({
        where: { id: existing.id },
        data: { notifiedAt: null, customerId: input.customerId ?? undefined },
      });
    } else {
      await this.prisma.client.stockAlert.create({
        data: {
          productId: input.productId,
          variantId: input.variantId ?? null,
          endpoint: input.endpoint,
          customerId: input.customerId ?? null,
          locale: input.locale === 'BN' ? 'BN' : 'EN',
        },
      });
    }
    return { ok: true };
  }

  /** How many people are waiting on a product — for the admin product page. */
  async waitingCount(productId: number): Promise<number> {
    return this.prisma.client.stockAlert.count({
      where: { productId, notifiedAt: null },
    });
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async sweep(): Promise<{ notified: number }> {
    const pending = await this.prisma.client.stockAlert.findMany({
      where: { notifiedAt: null },
      include: {
        product: {
          select: {
            id: true,
            slug: true,
            stock: true,
            status: true,
            deletedAt: true,
            translations: { select: { locale: true, name: true } },
          },
        },
        // A variant has no display name of its own — SKU is the only
        // human-readable handle on the row.
        variant: { select: { id: true, stock: true, sku: true } },
      },
      // A bound, so one restock of a popular product cannot make a single tick
      // send thousands of notifications. The rest go out on the next tick.
      take: 500,
    });
    if (pending.length === 0) return { notified: 0 };

    const ready = pending.filter((a) => {
      const p = a.product;
      // Never announce something a customer still cannot buy: an unpublished,
      // admin-only or deleted product is not "back".
      if (!p || p.deletedAt || p.status !== 'PUBLISHED') return false;
      // A variant alert tracks that variant's own stock; the parent Product row
      // of a variant product holds 0 by design.
      return a.variant ? a.variant.stock > 0 : p.stock > 0;
    });
    if (ready.length === 0) return { notified: 0 };

    // One notification per browser per product, and mark them sent regardless
    // of the delivery result: a dead subscription must not be retried forever,
    // and PushService already records the endpoint as revoked.
    let notified = 0;
    for (const alert of ready) {
      const name =
        alert.product.translations.find((t) => t.locale === alert.locale)?.name ??
        alert.product.translations[0]?.name ??
        alert.product.slug;
      const label = alert.variant?.sku ? `${name} (${alert.variant.sku})` : name;

      const result = await this.push.sendToEndpoints(
        [await this.subscriptionFor(alert.endpoint)].filter(
          (s): s is { endpoint: string; p256dh: string; auth: string } => s !== null,
        ),
        {
          title: 'Back in stock',
          body: `${label} is available again.`,
          url: `/products/${alert.product.slug}`,
          // Same tag per product, so two alerts for one product replace rather
          // than stack.
          tag: `restock-${alert.product.id}`,
        },
      );
      notified += result.sent;
    }

    await this.prisma.client.stockAlert.updateMany({
      where: { id: { in: ready.map((a) => a.id) } },
      data: { notifiedAt: new Date() },
    });

    this.logger.log(`Stock alert sweep notified ${notified} of ${ready.length} waiting alert(s)`);
    return { notified };
  }

  /** The push keys for one endpoint, or null if that browser has since lapsed. */
  private async subscriptionFor(endpoint: string) {
    const sub = await this.prisma.client.pushSubscription.findUnique({
      where: { endpoint },
      select: { endpoint: true, p256dh: true, auth: true, revokedAt: true },
    });
    if (!sub || sub.revokedAt) return null;
    return { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth };
  }
}
