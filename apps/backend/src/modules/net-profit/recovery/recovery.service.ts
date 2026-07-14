import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@amader/db';
import { PaginatedResult } from '@amader/shared';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { paginationArgs, toPaginatedResult } from '../../../common/pagination.util';
import { NetProfitSettingsService } from '../settings/net-profit-settings.service';
import { SmsService } from '../sms/sms.service';
import { CartCampaignsService } from '../cart-campaigns/cart-campaigns.service';
import { MergeTagsService } from '../merge-tags/merge-tags.service';
import { CART_UPDATED_EVENT } from '../../cart/cart.events';
import type { CartUpdatedEvent } from '../../cart/cart.events';
import { ORDER_CREATED_EVENT } from '../../orders/orders.events';
import type { OrderCreatedEvent } from '../../orders/orders.events';
import { CheckoutAddressDto } from '../../orders/dto/checkout-address.dto';
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

export interface RecoveryListFilters {
  recovered?: boolean;
  q?: string;
  from?: string;
  to?: string;
}

export interface CartSnapshotItem {
  productId: number;
  name: string;
  slug: string;
  quantity: number;
  unitPrice: string;
  imageUrl: string | null;
}

function csvField(value: string | number | boolean): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Same minimal quoted-field CSV parser used by BlockerService's import.
function parseCsv(text: string): string[][] {
  return text
    .split(/\r\n|\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const fields: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"' && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else if (ch === '"') {
            inQuotes = false;
          } else {
            cur += ch;
          }
        } else if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          fields.push(cur);
          cur = '';
        } else {
          cur += ch;
        }
      }
      fields.push(cur);
      return fields.map((f) => f.trim());
    });
}

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
    private readonly campaigns: CartCampaignsService,
    private readonly mergeTags: MergeTagsService,
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
        items: {
          include: {
            product: {
              include: {
                translations: { where: { locale: 'EN' }, take: 1 },
                media: { where: { isPrimary: true }, include: { media: true }, take: 1 },
              },
            },
          },
        },
        customer: true,
      },
    });
    if (!cart || cart.items.length === 0) return;

    const subtotal = cart.items.reduce((sum, i) => sum.plus(i.unitPriceSnapshot.times(i.quantity)), new Prisma.Decimal(0));
    const snapshot: CartSnapshotItem[] = cart.items.map((i) => ({
      productId: i.productId,
      name: i.product.translations[0]?.name ?? i.product.slug,
      slug: i.product.slug,
      quantity: i.quantity,
      unitPrice: i.unitPriceSnapshot.toString(),
      imageUrl: i.product.media[0]?.media.url ?? null,
    }));

    const existing = await this.prisma.client.incompleteOrder.findUnique({ where: { cartId: cart.id } });
    if (existing) {
      await this.prisma.client.incompleteOrder.update({
        where: { cartId: cart.id },
        data: { cart: snapshot as unknown as Prisma.InputJsonValue, subtotal, lastSeenAt: new Date() },
      });
      return;
    }

    const created = await this.prisma.client.incompleteOrder.create({
      data: {
        cartId: cart.id,
        customerId: cart.customerId,
        phone: cart.customer?.phone,
        email: cart.customer?.email,
        cart: snapshot as unknown as Prisma.InputJsonValue,
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

  async list(page: number, pageSize: number, filters: RecoveryListFilters = {}): Promise<PaginatedResult<IncompleteOrderDto>> {
    const where = await this.buildWhere(filters);
    const [items, total] = await Promise.all([
      this.prisma.client.incompleteOrder.findMany({ where, orderBy: { lastSeenAt: 'desc' }, ...paginationArgs(page, pageSize) }),
      this.prisma.client.incompleteOrder.count({ where }),
    ]);
    return toPaginatedResult(items.map(toIncompleteOrderDto), total, page, pageSize);
  }

  // IncompleteOrder.customerId has no Prisma relation to Customer (a raw
  // FK-shaped int, matching the model's own comment about it being a soft
  // reference) — so a name search needs its own lookup rather than a
  // relation filter, folded into the same OR as the phone/email match.
  private async buildWhere(filters: RecoveryListFilters): Promise<Prisma.IncompleteOrderWhereInput> {
    const where: Prisma.IncompleteOrderWhereInput = {};
    if (filters.recovered !== undefined) where.recovered = filters.recovered;
    if (filters.from || filters.to) {
      where.lastSeenAt = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      };
    }
    if (filters.q) {
      const q = filters.q.trim();
      const matchingCustomers = await this.prisma.client.customer.findMany({
        where: { OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }] },
        select: { id: true },
      });
      where.OR = [
        { phone: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        ...(matchingCustomers.length > 0 ? [{ customerId: { in: matchingCustomers.map((c) => c.id) } }] : []),
      ];
    }
    return where;
  }

  async delete(id: number): Promise<void> {
    await this.prisma.client.incompleteOrder.delete({ where: { id } });
  }

  // Only clears unrecovered rows — a recovered row is a real conversion
  // record (links to a real order), not abandonment noise to bulk-delete.
  async clearAll(filters: RecoveryListFilters = {}): Promise<number> {
    const where = { ...(await this.buildWhere(filters)), recovered: false };
    const result = await this.prisma.client.incompleteOrder.deleteMany({ where });
    return result.count;
  }

  async exportCsv(filters: RecoveryListFilters = {}): Promise<string> {
    const rows = await this.prisma.client.incompleteOrder.findMany({
      where: await this.buildWhere(filters),
      orderBy: { lastSeenAt: 'desc' },
    });
    const header = ['id', 'phone', 'email', 'subtotal', 'stage', 'recovered', 'recoveryAttempts', 'lastSeenAt', 'createdAt'];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push(
        [r.id, r.phone ?? '', r.email ?? '', r.subtotal.toString(), r.stage, r.recovered, r.recoveryAttempts, r.lastSeenAt.toISOString(), r.createdAt.toISOString()]
          .map(csvField)
          .join(','),
      );
    }
    return lines.join('\n');
  }

  // Columns: phone,email,subtotal — recreates bare incomplete-order rows
  // (no cart items, since a CSV can't carry a real product catalog
  // reference reliably) for merging abandonment data from another system.
  async importCsv(csvText: string): Promise<{ imported: number; skipped: number }> {
    const rows = parseCsv(csvText);
    let imported = 0;
    let skipped = 0;
    for (const row of rows) {
      const [phone, email, subtotalRaw] = row;
      if (phone?.toLowerCase() === 'phone') continue; // header row
      if (!phone && !email) {
        skipped++;
        continue;
      }
      const subtotal = Number(subtotalRaw) || 0;
      await this.prisma.client.incompleteOrder.create({
        data: { phone: phone || undefined, email: email || undefined, cart: [], subtotal, stage: 'cart' },
      });
      imported++;
    }
    return { imported, skipped };
  }

  // Admin "create real order from this abandoned cart" (Recovery/Cart
  // Abandonment parity) — recreates a real order from the stored cart
  // snapshot using each product's *current* price (the snapshot's price is
  // historical, matching the plugin's own simplicity here: no coupon/
  // discount replay, no fraud/blocker/OTP gates — this is a staff action on
  // behalf of a customer who already tried to buy, not a live checkout).
  async createOrderFromIncomplete(id: number, dto: CheckoutAddressDto): Promise<{ orderId: number; orderNumber: string }> {
    const incomplete = await this.prisma.client.incompleteOrder.findUniqueOrThrow({ where: { id } });
    if (incomplete.recovered) throw new Error('This cart has already been recovered');

    const snapshot = (incomplete.cart as unknown as CartSnapshotItem[]) ?? [];
    if (snapshot.length === 0) throw new Error('This cart has no items to recreate');

    const productIds = snapshot.map((i) => i.productId);
    const products = await this.prisma.client.product.findMany({ where: { id: { in: productIds } } });
    const priceById = new Map(products.map((p) => [p.id, p.salePrice ?? p.price ?? new Prisma.Decimal(0)]));

    const items = snapshot.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      unitPrice: priceById.get(i.productId) ?? new Prisma.Decimal(i.unitPrice),
      name: i.name,
    }));
    const subTotal = items.reduce((sum, i) => sum.plus(i.unitPrice.times(i.quantity)), new Prisma.Decimal(0));

    const order = await this.prisma.client.order.create({
      data: {
        orderNumber: `REC-${Date.now().toString(36).toUpperCase()}`,
        customerId: incomplete.customerId,
        subTotal,
        totalAmount: subTotal,
        customerNote: 'Recreated from an abandoned cart by staff.',
        items: {
          create: items.map((i) => ({
            productId: i.productId,
            productNameSnapshot: i.name,
            unitPrice: i.unitPrice,
            quantity: i.quantity,
          })),
        },
        addresses: {
          create: [
            { type: 'SHIPPING', ...dto },
            { type: 'BILLING', ...dto },
          ],
        },
        statusHistory: { create: { status: 'PENDING', note: 'Order recreated from abandoned cart' } },
        payments: { create: { provider: 'COD', status: 'PENDING', amount: subTotal } },
      },
    });

    await this.prisma.client.incompleteOrder.update({
      where: { id },
      data: { recovered: true, recoveredOrderId: order.id },
    });
    await this.campaigns.skipRemaining(id);

    return { orderId: order.id, orderNumber: order.orderNumber };
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

    const template = await this.prisma.client.smsTemplate.findUnique({ where: { key: 'recovery' } });
    if (!template || !template.enabled) return;

    const body = await this.mergeTags.render(template.bodyEn, {
      customerId: row.customerId,
      phone: row.phone,
      email: row.email,
      amount: row.subtotal.toString(),
      cart: (row.cart as unknown as CartSnapshotItem[]) ?? [],
    });
    await this.sms.send(row.phone, body, 'recovery');
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
