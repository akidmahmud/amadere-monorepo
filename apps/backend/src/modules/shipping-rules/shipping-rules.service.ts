import { Injectable } from '@nestjs/common';
import { Prisma } from '@amader/db';
import {
  chargeableWeightKg,
  quoteShippingRule,
  ShippingRulesConfig,
  ShippingDeliveryType,
  STEADFAST_SHIPPING_RULES,
} from '@amader/shared';
import { PrismaService } from '../../common/prisma/prisma.service';

export const SHIPPING_RULES_KEY = 'shipping_rules';

const Decimal = Prisma.Decimal;

export interface ResolvedQuote {
  amount: number | null;
  ruleId: string | null;
  ruleName: string | null;
  weightKg: number;
  district: string | null;
}

interface QuoteItem {
  productId?: number | null;
  variantId?: number | null;
  quantity: number;
}

interface QuoteInput {
  orderId?: number | null;
  district?: string | null;
  items?: QuoteItem[];
  weightKg?: number | null;
  deliveryType?: ShippingDeliveryType;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The courier rate card, stored as one row in the generic Setting table —
 * the same reuse-over-a-new-table pattern as ShippingZonesService. There is
 * one card, it is edited whole, and it is read on every quote, so a table
 * would buy nothing but joins.
 */
@Injectable()
export class ShippingRulesService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(): Promise<ShippingRulesConfig> {
    const row = await this.prisma.client.setting.findUnique({
      where: { key: SHIPPING_RULES_KEY },
    });
    return this.merge(row?.value);
  }

  async update(input: ShippingRulesConfig): Promise<ShippingRulesConfig> {
    const next = this.merge(input);
    await this.prisma.client.setting.upsert({
      where: { key: SHIPPING_RULES_KEY },
      create: { key: SHIPPING_RULES_KEY, value: next as never },
      update: { value: next as never },
    });
    return next;
  }

  /** Quote from whichever context the caller has — an order, a draft line
   *  list, or a bare weight. */
  async quote(input: QuoteInput): Promise<ResolvedQuote> {
    const config = await this.getConfig();

    let district = input.district?.trim() || null;
    let items: QuoteItem[] = input.items ?? [];

    if (input.orderId) {
      const order = await this.prisma.client.order.findUnique({
        where: { id: input.orderId },
        select: {
          addresses: {
            where: { type: 'SHIPPING' },
            select: { district: true },
            take: 1,
          },
          items: { select: { productId: true, variantId: true, quantity: true } },
        },
      });
      district = district ?? order?.addresses[0]?.district ?? null;
      if (items.length === 0) items = order?.items ?? [];
    }

    const weightKg =
      input.weightKg != null && input.weightKg > 0
        ? input.weightKg
        : (await this.computeWeight(items)).toNumber();

    // Priced on the BILLED weight, not the raw one — this endpoint answers
    // "what will the courier charge us", which is what staff act on.
    const result = quoteShippingRule(config, {
      district,
      weightKg: chargeableWeightKg(weightKg),
      deliveryType: input.deliveryType,
    });

    return {
      amount: result?.amount ?? null,
      ruleId: result?.ruleId ?? null,
      ruleName: result?.ruleName ?? null,
      weightKg,
      district,
    };
  }

  /**
   * The checkout fee, or null when the rules must not be charged — the
   * toggle is off, or nothing matched. Null means "keep using the shipping
   * zones", never "free".
   */
  async checkoutFee(
    district: string | undefined,
    items: QuoteItem[],
  ): Promise<Prisma.Decimal | null> {
    const config = await this.getConfig();
    if (!config.applyOnCheckout) return null;
    const weightKg = (await this.computeWeight(items)).toNumber();
    const result = quoteShippingRule(config, { district, weightKg });
    return result ? new Decimal(result.amount) : null;
  }

  // ------------------------------------------------------------------

  /** Two queries regardless of basket size — the same weightOverride /
   *  shippableWeight precedence ShipmentsService uses when it weighs a real
   *  parcel, so a quote and the actual dispatch never disagree. */
  private async computeWeight(items: QuoteItem[]): Promise<Prisma.Decimal> {
    if (items.length === 0) return new Decimal(0);

    const variantIds = [
      ...new Set(items.map((i) => i.variantId).filter((v): v is number => !!v)),
    ];
    const productIds = [
      ...new Set(items.map((i) => i.productId).filter((v): v is number => !!v)),
    ];

    const variants = variantIds.length
      ? await this.prisma.client.productVariant.findMany({
          where: { id: { in: variantIds } },
          select: {
            id: true,
            weightOverride: true,
            product: { select: { shippableWeight: true } },
          },
        })
      : [];
    const products = productIds.length
      ? await this.prisma.client.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, shippableWeight: true },
        })
      : [];

    const byVariant = new Map<number, Prisma.Decimal | null>(
      variants.map((v) => [v.id, v.weightOverride ?? v.product.shippableWeight]),
    );
    const byProduct = new Map<number, Prisma.Decimal | null>(
      products.map((p) => [p.id, p.shippableWeight]),
    );

    let total = new Decimal(0);
    for (const item of items) {
      const weight = item.variantId
        ? byVariant.get(item.variantId)
        : item.productId
          ? byProduct.get(item.productId)
          : null;
      if (weight) total = total.plus(weight.times(item.quantity));
    }
    return total;
  }

  /** A malformed or missing row must still price parcels, so it degrades to
   *  the shipped Steadfast card rather than to an empty list. */
  private merge(stored: unknown): ShippingRulesConfig {
    if (!isPlainObject(stored) || !Array.isArray(stored.rules)) {
      return structuredClone(STEADFAST_SHIPPING_RULES);
    }
    const rules = (stored.rules as unknown[])
      .filter(isPlainObject)
      .map((r, i) => ({
        id: typeof r.id === 'string' && r.id ? r.id : 'rule-' + String(i),
        name: typeof r.name === 'string' ? r.name : '',
        deliveryType:
          r.deliveryType === 'POINT' ? ('POINT' as const) : ('HOME' as const),
        districts: Array.isArray(r.districts)
          ? (r.districts as unknown[]).filter(
              (d): d is string => typeof d === 'string',
            )
          : [],
        tiers: Array.isArray(r.tiers)
          ? (r.tiers as unknown[])
              .filter(isPlainObject)
              .map((t) => ({
                upToKg: typeof t.upToKg === 'number' ? t.upToKg : 0,
                fee: typeof t.fee === 'number' ? t.fee : 0,
              }))
              .filter((t) => t.upToKg > 0)
          : [],
        perKgFee:
          typeof r.perKgFee === 'number' && r.perKgFee >= 0 ? r.perKgFee : 0,
      }));

    return structuredClone({
      applyOnCheckout: stored.applyOnCheckout === true,
      rules: rules.filter((r) => r.tiers.length > 0),
    });
  }
}
