import { Injectable } from '@nestjs/common';
import { OrderStatus, Prisma } from '@amader/db';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { normalizeBdPhone } from '@amader/shared';
import { FraudService } from '../fraud/fraud.service';
import { OtpSecurityService } from '../otp-security/otp-security.service';
import { RULE_KEYS, RuleKey, BlockerSettings } from './blocker-settings.types';

export interface BlockCheckoutContext {
  phone: string;
  email: string;
  ip: string;
  deviceId: string;
  name: string;
  address: string;
  orderTotal: number;
  productIds: number[];
  checkoutStartedAt?: number; // unix seconds, set by the storefront when the checkout page loads
}

export interface RuleMatch {
  rule: RuleKey;
  reason: string;
  metadata?: Record<string, unknown>;
}

const IN_FLIGHT_STATUSES: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING', 'HOLD'];
const COUNTED_TODAY_STATUSES: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'HOLD'];

// Auto-block rule engine (ADDENDUM Blocker Manager parity) — 12 rules ported
// from the reference plugin's evaluate_auto_rules(), re-expressed against
// our own Postgres schema instead of WooCommerce's post/postmeta tables.
// Evaluated in the same most-specific-first order as the plugin so the
// first enabled match wins.
@Injectable()
export class BlockerRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fraud: FraudService,
    private readonly otpSecurity: OtpSecurityService,
  ) {}

  async evaluate(context: BlockCheckoutContext, settings: BlockerSettings): Promise<RuleMatch | null> {
    for (const rule of RULE_KEYS) {
      if (!settings.rules[rule].enabled) continue;
      const match = await this.runRule(rule, context, settings);
      if (match) return match;
    }
    return null;
  }

  private async runRule(rule: RuleKey, ctx: BlockCheckoutContext, settings: BlockerSettings): Promise<RuleMatch | null> {
    switch (rule) {
      case 'phoneValidation':
        return this.phoneValidation(ctx);
      case 'blacklistedEmailDomain':
        return this.blacklistedEmailDomain(ctx, settings);
      case 'courierSuccessRate':
        return this.courierSuccessRate(ctx, settings);
      case 'duplicateOrder':
        return this.duplicateOrder(ctx, settings);
      case 'processingCooldown':
        return this.processingCooldown(ctx, settings);
      case 'bulkOrderBlocker':
        return this.bulkOrderBlocker(ctx, settings);
      case 'minimumOrderAmount':
        return this.minimumOrderAmount(ctx, settings);
      case 'dailyOrderLimit':
        return this.dailyOrderLimit(ctx, settings);
      case 'newCustomerHighValue':
        return this.newCustomerHighValue(ctx, settings);
      case 'speedBotDetection':
        return this.speedBotDetection(ctx, settings);
      case 'proxyTorDetection':
        return this.proxyTorDetection(ctx);
      case 'ipTracker':
        return this.ipTracker(ctx, settings);
      default:
        return null;
    }
  }

  private phoneValidation(ctx: BlockCheckoutContext): RuleMatch | null {
    if (!ctx.phone) return null;
    if (normalizeBdPhone(ctx.phone)) return null;
    return { rule: 'phoneValidation', reason: 'Invalid Bangladesh phone number format.' };
  }

  private blacklistedEmailDomain(ctx: BlockCheckoutContext, settings: BlockerSettings): RuleMatch | null {
    if (!ctx.email.includes('@')) return null;
    const domain = ctx.email.split('@').pop()!.toLowerCase();
    if (!settings.thresholds.blacklistedDomains.map((d) => d.toLowerCase()).includes(domain)) return null;
    return { rule: 'blacklistedEmailDomain', reason: `Blacklisted email domain: ${domain}.` };
  }

  private async courierSuccessRate(ctx: BlockCheckoutContext, settings: BlockerSettings): Promise<RuleMatch | null> {
    if (!ctx.phone) return null;
    const check = await this.fraud.evaluate(ctx.phone).catch(() => null);
    if (!check || !check.totalOrders || check.successRate === null) return null;
    const threshold = settings.thresholds.courierThresholdPercent;
    if (check.successRate >= threshold) return null;
    return {
      rule: 'courierSuccessRate',
      reason: `Courier success rate is ${check.successRate}%, below the ${threshold}% threshold.`,
      metadata: { successRate: check.successRate, totalOrders: check.totalOrders },
    };
  }

  private async matchingOrderIds(ctx: BlockCheckoutContext, statuses: OrderStatus[], sinceMinutes: number, take = 10): Promise<number[]> {
    const since = new Date(Date.now() - sinceMinutes * 60_000);
    const or: Prisma.OrderWhereInput[] = [];
    if (ctx.phone) or.push({ addresses: { some: { type: 'SHIPPING', phone: ctx.phone } } });
    if (ctx.email) or.push({ addresses: { some: { type: 'SHIPPING', email: { equals: ctx.email, mode: 'insensitive' } } } });
    if (ctx.ip) or.push({ ipAddress: ctx.ip });
    if (or.length === 0) return [];

    const rows = await this.prisma.client.order.findMany({
      where: { status: { in: statuses }, createdAt: { gt: since }, OR: or },
      orderBy: { createdAt: 'desc' },
      take,
      select: { id: true, items: { select: { productId: true } } },
    });
    return rows.map((r) => r.id);
  }

  private async duplicateOrder(ctx: BlockCheckoutContext, settings: BlockerSettings): Promise<RuleMatch | null> {
    if (ctx.productIds.length === 0) return null;
    const minutes = Math.max(1, settings.thresholds.duplicateWindowMinutes);
    const since = new Date(Date.now() - minutes * 60_000);
    const or: Prisma.OrderWhereInput[] = [];
    if (ctx.phone) or.push({ addresses: { some: { type: 'SHIPPING', phone: ctx.phone } } });
    if (ctx.email) or.push({ addresses: { some: { type: 'SHIPPING', email: { equals: ctx.email, mode: 'insensitive' } } } });
    if (or.length === 0) return null;

    const rows = await this.prisma.client.order.findMany({
      where: {
        status: { in: ['PENDING', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'HOLD'] },
        createdAt: { gt: since },
        OR: or,
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { id: true, items: { select: { productId: true } } },
    });

    const wanted = new Set(ctx.productIds);
    for (const row of rows) {
      const ids = new Set(row.items.map((i) => i.productId).filter((id): id is number => id != null));
      if (ids.size === wanted.size && [...wanted].every((id) => ids.has(id))) {
        return {
          rule: 'duplicateOrder',
          reason: `Duplicate order found within ${minutes} minutes.`,
          metadata: { orderId: row.id },
        };
      }
    }
    return null;
  }

  private async processingCooldown(ctx: BlockCheckoutContext, settings: BlockerSettings): Promise<RuleMatch | null> {
    const minutes = Math.max(1, settings.thresholds.processingCooldownMinutes);
    const ids = await this.matchingOrderIds(ctx, IN_FLIGHT_STATUSES, minutes, 5);
    if (ids.length === 0) return null;
    return {
      rule: 'processingCooldown',
      reason: `A processing order exists within the last ${minutes} minutes.`,
      metadata: { count: ids.length, matchedOrders: ids },
    };
  }

  private async bulkOrderBlocker(ctx: BlockCheckoutContext, settings: BlockerSettings): Promise<RuleMatch | null> {
    const window = Math.max(1, settings.thresholds.bulkWindowMinutes);
    const groups: { key: string; statuses: OrderStatus[]; limit: number; label: string }[] = [
      { key: 'pending', statuses: ['PENDING'], limit: settings.thresholds.bulkPendingLimit, label: 'Pending' },
      { key: 'on-hold', statuses: ['HOLD'], limit: settings.thresholds.bulkHoldLimit, label: 'On-Hold' },
      { key: 'failed', statuses: ['CANCELED'], limit: settings.thresholds.bulkFailedLimit, label: 'Failed' },
    ];
    for (const group of groups) {
      const ids = await this.matchingOrderIds(ctx, group.statuses, window, Math.max(5, group.limit));
      if (ids.length >= Math.max(1, group.limit)) {
        return {
          rule: 'bulkOrderBlocker',
          reason: `${group.label} order limit reached: ${ids.length} (limit: ${group.limit}) in ${window} minutes.`,
          metadata: { count: ids.length, limit: group.limit, triggerStatus: group.key, triggerLabel: group.label, matchedOrders: ids },
        };
      }
    }
    return null;
  }

  private minimumOrderAmount(ctx: BlockCheckoutContext, settings: BlockerSettings): RuleMatch | null {
    const min = settings.thresholds.minOrderAmount;
    if (min <= 0 || ctx.orderTotal <= 0 || ctx.orderTotal >= min) return null;
    return { rule: 'minimumOrderAmount', reason: `Order total is below the minimum amount: ৳${min}.` };
  }

  private async dailyOrderLimit(ctx: BlockCheckoutContext, settings: BlockerSettings): Promise<RuleMatch | null> {
    const limit = Math.max(1, settings.thresholds.dailyOrderLimit);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const ids = await this.matchingOrderIds(ctx, COUNTED_TODAY_STATUSES, (Date.now() - startOfDay.getTime()) / 60_000, limit + 5);
    if (ids.length < limit) return null;
    return { rule: 'dailyOrderLimit', reason: `Today order limit reached: ${ids.length} orders.`, metadata: { count: ids.length } };
  }

  private async newCustomerHighValue(ctx: BlockCheckoutContext, settings: BlockerSettings): Promise<RuleMatch | null> {
    const amount = settings.thresholds.highValueAmount;
    if (amount <= 0 || ctx.orderTotal < amount) return null;
    const priorIds = await this.matchingOrderIds(ctx, ['COMPLETED', 'PROCESSING'], 525_600, 1);
    if (priorIds.length > 0) return null;
    return { rule: 'newCustomerHighValue', reason: `New customer high value order over ৳${amount}.` };
  }

  private speedBotDetection(ctx: BlockCheckoutContext, settings: BlockerSettings): RuleMatch | null {
    if (!ctx.checkoutStartedAt) return null;
    const seconds = Math.max(1, settings.thresholds.speedSeconds);
    const elapsed = Date.now() / 1000 - ctx.checkoutStartedAt;
    if (elapsed >= seconds) return null;
    return { rule: 'speedBotDetection', reason: `Checkout submitted too fast: under ${seconds} seconds.` };
  }

  private async proxyTorDetection(ctx: BlockCheckoutContext): Promise<RuleMatch | null> {
    if (!ctx.ip) return null;
    const result = await this.otpSecurity.evaluate(ctx.ip).catch(() => ({ isVpn: false }));
    if (!result.isVpn) return null;
    return { rule: 'proxyTorDetection', reason: 'VPN or proxy detected (IP reputation check).' };
  }

  private async ipTracker(ctx: BlockCheckoutContext, settings: BlockerSettings): Promise<RuleMatch | null> {
    if (!ctx.ip) return null;
    const max = Math.max(1, settings.thresholds.ipTrackerMaxOrders);
    const windowMinutes = Math.max(1, settings.thresholds.ipTrackerWindowMinutes);
    const since = new Date(Date.now() - windowMinutes * 60_000);
    const rows = await this.prisma.client.order.findMany({
      where: { ipAddress: ctx.ip, createdAt: { gt: since } },
      orderBy: { createdAt: 'desc' },
      take: Math.max(5, max),
      select: { id: true },
    });
    if (rows.length < max) return null;
    return {
      rule: 'ipTracker',
      reason: `This IP has ${rows.length} orders (limit: ${max}) in ${windowMinutes} minutes.`,
      metadata: { count: rows.length, limit: max, window: windowMinutes, matchedOrders: rows.map((r) => r.id) },
    };
  }
}
