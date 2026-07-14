import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Prisma, RiskLevel } from '@amader/db';
import { normalizeBdPhone, PaginatedResult } from '@amader/shared';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { paginationArgs, toPaginatedResult } from '../../../common/pagination.util';
import { NetProfitSettingsService } from '../settings/net-profit-settings.service';
import { FraudSource } from './fraud-source.interface';
import { SteadfastFraudSource } from './providers/steadfast-fraud-source';
import { FraudSettingsDto, UpdateFraudSettingsDto } from './dto/fraud-settings.dto';
import { FraudCheckDto, FraudSavingDto, toFraudCheckDto, toFraudSavingDto } from './fraud.mapper';

const SETTINGS_NAMESPACE = 'fraud';

const FRAUD_SETTINGS_DEFAULTS: FraudSettingsDto = {
  enabled: false,
  acceptPercent: 80,
  allowNoHistory: true,
  advanceEnabled: false,
  advanceScoreThreshold: 50,
  advanceRequiredPercent: 100,
  blockEnabled: false,
  cacheTtlHours: 72,
  blockMessageEn:
    "Sorry, we couldn't confirm this order automatically. Please contact support or choose a different payment method.",
  blockMessageBn:
    'দুঃখিত, আমরা এই অর্ডারটি স্বয়ংক্রিয়ভাবে নিশ্চিত করতে পারিনি। অনুগ্রহ করে সাপোর্টে যোগাযোগ করুন অথবা ভিন্ন পেমেন্ট পদ্ধতি বেছে নিন।',
  deliveryFallback: 0,
};

export type FraudVerdict = 'pass' | 'needs_advance' | 'block';

export interface CheckoutGateResult {
  allowed: boolean;
  riskLevel: RiskLevel;
  verdict: FraudVerdict;
  blockMessage?: { en: string; bn: string };
  requireAdvancePercent?: number;
}

@Injectable()
export class FraudService {
  private readonly logger = new Logger(FraudService.name);
  private readonly sources: FraudSource[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: NetProfitSettingsService,
    steadfast: SteadfastFraudSource,
  ) {
    // Only sources with a real, working check() go here (ADDENDUM §A) — a
    // future third-party BD aggregator would be a second entry.
    this.sources = [steadfast];
  }

  async getSettings(): Promise<FraudSettingsDto> {
    return this.settings.getNamespace(SETTINGS_NAMESPACE, FRAUD_SETTINGS_DEFAULTS);
  }

  async updateSettings(dto: UpdateFraudSettingsDto): Promise<FraudSettingsDto> {
    await this.settings.setNamespace(SETTINGS_NAMESPACE, dto);
    return this.getSettings();
  }

  async evaluate(rawPhone: string, force = false): Promise<FraudCheckDto> {
    const settings = await this.getSettings();
    if (!settings.enabled) {
      throw new ServiceUnavailableException('Fraud detection is not enabled');
    }

    const phone = normalizeBdPhone(rawPhone);
    if (!phone) throw new BadRequestException('Invalid Bangladeshi phone number');

    if (!force) {
      const cached = await this.prisma.client.fraudCheck.findUnique({ where: { phone } });
      if (cached && cached.expiresAt > new Date()) {
        return toFraudCheckDto({ ...cached, source: 'cache' });
      }
    }

    const breakdown: Record<string, unknown> = {};
    let total = 0;
    let delivered = 0;
    let cancelled = 0;

    await Promise.all(
      this.sources.map(async (source) => {
        let outcome;
        try {
          outcome = await source.check(phone);
        } catch (err) {
          this.logger.warn(`${source.name} fraud source threw unexpectedly: ${err instanceof Error ? err.message : String(err)}`);
          outcome = { unavailable: true } as const;
        }
        if (outcome.unavailable) {
          breakdown[source.name] = { unavailable: true };
          return;
        }
        // A source's own byCourier breakdown (if it aggregates multiple
        // couriers itself, e.g. a future third-party aggregator) is merged
        // directly rather than nested a second level under the source name.
        if (outcome.byCourier) {
          Object.assign(breakdown, outcome.byCourier);
        } else {
          breakdown[source.name] = { total: outcome.total, delivered: outcome.delivered, cancelled: outcome.cancelled };
        }
        total += outcome.total;
        delivered += outcome.delivered;
        cancelled += outcome.cancelled;
      }),
    );

    const successRate = total > 0 ? delivered / total : null;
    const riskLevel = this.deriveRiskLevel(successRate, total, settings);

    const expiresAt = new Date(Date.now() + settings.cacheTtlHours * 60 * 60 * 1000);

    const saved = await this.prisma.client.fraudCheck.upsert({
      where: { phone },
      create: {
        phone,
        totalOrders: total,
        delivered,
        cancelled,
        successRate,
        riskLevel,
        breakdown: breakdown as Prisma.InputJsonValue,
        source: 'live',
        expiresAt,
      },
      update: {
        totalOrders: total,
        delivered,
        cancelled,
        successRate,
        riskLevel,
        breakdown: breakdown as Prisma.InputJsonValue,
        source: 'live',
        checkedAt: new Date(),
        expiresAt,
      },
    });

    return toFraudCheckDto(saved);
  }

  // RiskLevel badge derived from the exact same thresholds the checkout
  // gate acts on (ADDENDUM §A: "the badge and the gate never disagree").
  private deriveRiskLevel(successRate: number | null, total: number, settings: FraudSettingsDto): RiskLevel {
    if (total === 0) return settings.allowNoHistory ? 'UNKNOWN' : 'HIGH';
    if (successRate === null) return 'UNKNOWN';
    const pct = successRate * 100;
    if (pct >= settings.acceptPercent) return 'LOW';
    if (pct >= settings.advanceScoreThreshold) return 'MEDIUM';
    return 'HIGH';
  }

  // Storefront COD checkout gate. Returns a verdict for CheckoutService to
  // act on rather than throwing itself, so the caller controls exactly
  // when/whether to write the FraudSaving row (only once it knows the
  // order really would have been created).
  //
  // Ladder (ADDENDUM §A): no history -> pass unless allowNoHistory=false;
  // successRate% >= acceptPercent -> pass; below advanceScoreThreshold (and
  // advance enabled) -> needs_advance; else below acceptPercent (and block
  // enabled) -> block; otherwise pass (fail-open when neither is enabled).
  async evaluateCheckoutGate(rawPhone: string): Promise<CheckoutGateResult> {
    const settings = await this.getSettings();
    if (!settings.enabled) {
      return { allowed: true, riskLevel: 'UNKNOWN', verdict: 'pass' };
    }

    const check = await this.evaluate(rawPhone);
    const noHistory = check.totalOrders === 0;

    if (noHistory) {
      if (settings.allowNoHistory) {
        return { allowed: true, riskLevel: check.riskLevel as RiskLevel, verdict: 'pass' };
      }
      // Treated as risky — falls through to the same block/advance checks
      // below using a 0% success rate.
    }

    const pct = noHistory ? 0 : (check.successRate ?? 0) * 100;

    if (pct >= settings.acceptPercent) {
      return { allowed: true, riskLevel: check.riskLevel as RiskLevel, verdict: 'pass' };
    }

    if (settings.advanceEnabled && pct < settings.advanceScoreThreshold) {
      return {
        allowed: true,
        riskLevel: check.riskLevel as RiskLevel,
        verdict: 'needs_advance',
        requireAdvancePercent: settings.advanceRequiredPercent,
      };
    }

    if (settings.blockEnabled) {
      return {
        allowed: false,
        riskLevel: check.riskLevel as RiskLevel,
        verdict: 'block',
        blockMessage: { en: settings.blockMessageEn, bn: settings.blockMessageBn },
      };
    }

    // Below acceptPercent but neither advance nor block is enabled — the
    // "flag only" state from the base spec, expressed as fail-open here.
    return { allowed: true, riskLevel: check.riskLevel as RiskLevel, verdict: 'pass' };
  }

  // Read-only, never-throws peek at whatever evaluateCheckoutGate() just
  // computed/cached for this phone — used by the public pre-flight endpoint
  // to attach successRate/totalOrders without a second live source call.
  async peekCached(rawPhone: string): Promise<{ totalOrders: number; successRate: number | null } | null> {
    const phone = normalizeBdPhone(rawPhone);
    if (!phone) return null;
    const row = await this.prisma.client.fraudCheck.findUnique({ where: { phone } });
    return row ? { totalOrders: row.totalOrders, successRate: row.successRate } : null;
  }

  async recordSaving(phone: string, amount: Prisma.Decimal, reason: string, orderId?: number): Promise<void> {
    await this.prisma.client.fraudSaving.create({
      data: { phone: normalizeBdPhone(phone) ?? phone, amount, reason, orderId },
    });
  }

  // A blocked/gated order never reaches a real courier quote, so "amount
  // saved" needs an assumed delivery charge on top of the order total —
  // the admin-configurable deliveryFallback setting fills that gap.
  async savingAmountFor(orderTotal: Prisma.Decimal | number): Promise<Prisma.Decimal> {
    const settings = await this.getSettings();
    return new Prisma.Decimal(orderTotal).plus(settings.deliveryFallback);
  }

  async adminList(query: { page: number; pageSize: number; risk?: RiskLevel }): Promise<PaginatedResult<FraudCheckDto>> {
    const where = query.risk ? { riskLevel: query.risk } : {};
    const [items, total] = await Promise.all([
      this.prisma.client.fraudCheck.findMany({
        where,
        orderBy: { checkedAt: 'desc' },
        ...paginationArgs(query.page, query.pageSize),
      }),
      this.prisma.client.fraudCheck.count({ where }),
    ]);
    return toPaginatedResult(items.map(toFraudCheckDto), total, query.page, query.pageSize);
  }

  async adminGet(phone: string): Promise<FraudCheckDto> {
    const normalized = normalizeBdPhone(phone);
    if (!normalized) throw new BadRequestException('Invalid Bangladeshi phone number');
    const existing = await this.prisma.client.fraudCheck.findUnique({ where: { phone: normalized } });
    if (existing && existing.expiresAt > new Date()) return toFraudCheckDto(existing);
    return this.evaluate(normalized);
  }

  async savingsList(query: { page: number; pageSize: number }): Promise<PaginatedResult<FraudSavingDto> & { totalAmount: string }> {
    const [items, total, agg] = await Promise.all([
      this.prisma.client.fraudSaving.findMany({
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(query.page, query.pageSize),
      }),
      this.prisma.client.fraudSaving.count(),
      this.prisma.client.fraudSaving.aggregate({ _sum: { amount: true } }),
    ]);
    return {
      ...toPaginatedResult(items.map(toFraudSavingDto), total, query.page, query.pageSize),
      totalAmount: (agg._sum.amount ?? new Prisma.Decimal(0)).toString(),
    };
  }

  // Latest FraudCheck per phone, for the orders board's risk badge —
  // returns a Map so the caller can do one query for many order rows
  // instead of N+1 lookups.
  async latestByPhones(phones: string[]): Promise<Map<string, FraudCheckDto>> {
    const normalized = phones
      .map((p) => normalizeBdPhone(p))
      .filter((p): p is string => p !== null);
    if (normalized.length === 0) return new Map();
    const rows = await this.prisma.client.fraudCheck.findMany({
      where: { phone: { in: normalized } },
    });
    return new Map(rows.map((r) => [r.phone, toFraudCheckDto(r)]));
  }
}
