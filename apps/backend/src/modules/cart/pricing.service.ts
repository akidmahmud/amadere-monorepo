import { Injectable } from '@nestjs/common';
import { Discount, Prisma, UpsellStage } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpsellBarSettingsService } from '../upsell-bar/upsell-bar-settings.service';

const Decimal = Prisma.Decimal;
type DecimalValue = Prisma.Decimal;

export interface PricedLine {
  productId: number;
  variantId: number | null;
  quantity: number;
  unitPrice: DecimalValue;
  lineTotal: DecimalValue;
}

export interface AppliedDiscount {
  source: 'COUPON' | 'PROMOTION' | 'UPSELL';
  label: string;
  amount: DecimalValue;
  freeShipping?: boolean;
}

export interface UpsellStageProgress {
  label: string;
  triggerType: 'ITEM_COUNT' | 'ORDER_AMOUNT';
  triggerValue: string;
  unlocked: boolean;
}

export interface UpsellBarResult {
  stages: UpsellStageProgress[];
  currentCount: string;
  nextStage: { label: string; triggerType: 'ITEM_COUNT' | 'ORDER_AMOUNT'; remaining: string } | null;
}

export interface PricingResult {
  lines: PricedLine[];
  subTotal: DecimalValue;
  discounts: AppliedDiscount[];
  totalDiscount: DecimalValue;
  total: DecimalValue;
  couponError: string | null;
  upsell: UpsellBarResult | null;
}

export interface CartLineInput {
  productId: number;
  variantId: number | null;
  quantity: number;
}

// Effective price honouring the product/variant sale window.
function effectivePrice(
  base: DecimalValue,
  salePrice: DecimalValue | null,
  startsAt: Date | null,
  endsAt: Date | null,
): DecimalValue {
  if (!salePrice) return base;
  const now = new Date();
  if (startsAt && now < startsAt) return base;
  if (endsAt && now > endsAt) return base;
  return salePrice;
}

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly upsellSettings: UpsellBarSettingsService,
  ) {}

  async price(
    lines: CartLineInput[],
    options: { couponCode?: string | null; customerId?: number },
  ): Promise<PricingResult> {
    const pricedLines = await this.priceLines(lines);
    const subTotal = pricedLines.reduce(
      (sum, l) => sum.plus(l.lineTotal),
      new Decimal(0),
    );

    const discounts: AppliedDiscount[] = [];
    let couponError: string | null = null;

    discounts.push(...(await this.promotionDiscounts(pricedLines, subTotal)));

    if (options.couponCode) {
      const result = await this.couponDiscount(
        options.couponCode,
        pricedLines,
        subTotal,
        options.customerId,
      );
      if (typeof result === 'string') couponError = result;
      else discounts.push(result);
    }

    // PHASE 2 HOOK: reward-point redemption and referral-credit application
    // plug in here as additional AppliedDiscount entries.

    const otherDiscountsTotal = discounts.reduce(
      (sum, d) => sum.plus(d.amount),
      new Decimal(0),
    );
    const upsell = await this.applyUpsellBar(pricedLines, subTotal, discounts, otherDiscountsTotal);

    const totalDiscount = discounts.reduce(
      (sum, d) => sum.plus(d.amount),
      new Decimal(0),
    );
    const total = Decimal.max(subTotal.minus(totalDiscount), new Decimal(0));

    return {
      lines: pricedLines,
      subTotal,
      discounts,
      totalDiscount,
      total,
      couponError,
      upsell,
    };
  }

  // Public so AdminOrderCreationService (manual orders) can reuse the same
  // sale-window-aware price resolution real checkout uses, instead of
  // reimplementing effectivePrice() a second time.
  async priceLines(lines: CartLineInput[]): Promise<PricedLine[]> {
    if (lines.length === 0) return [];

    const products = await this.prisma.client.product.findMany({
      where: { id: { in: lines.map((l) => l.productId) } },
      include: { variants: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    return lines.map((line) => {
      const product = byId.get(line.productId);
      if (!product) {
        return {
          ...line,
          unitPrice: new Decimal(0),
          lineTotal: new Decimal(0),
        };
      }

      let unitPrice: DecimalValue;
      if (line.variantId) {
        const variant = product.variants.find((v) => v.id === line.variantId);
        unitPrice = variant
          ? effectivePrice(
              variant.price,
              variant.salePrice,
              product.saleStartsAt,
              product.saleEndsAt,
            )
          : new Decimal(0);
      } else {
        unitPrice = effectivePrice(
          product.price ?? new Decimal(0),
          product.salePrice,
          product.saleStartsAt,
          product.saleEndsAt,
        );
      }

      return {
        ...line,
        unitPrice,
        lineTotal: unitPrice.times(line.quantity),
      };
    });
  }

  private async promotionDiscounts(
    lines: PricedLine[],
    subTotal: DecimalValue,
  ): Promise<AppliedDiscount[]> {
    const promotions = await this.prisma.client.discount.findMany({
      where: { type: 'PROMOTION', status: 'PUBLISHED' },
      include: { products: true, categories: true },
    });

    const applied: AppliedDiscount[] = [];
    for (const promo of promotions) {
      if (!this.isWithinWindow(promo) || this.isExhausted(promo)) continue;
      if (promo.minOrderAmount && subTotal.lessThan(promo.minOrderAmount))
        continue;

      const eligibleBase = await this.eligibleBase(promo, lines, subTotal);
      if (eligibleBase.lessThanOrEqualTo(0)) continue;

      const amount = this.computeAmount(promo, eligibleBase);
      if (amount.lessThanOrEqualTo(0) && promo.valueType !== 'FREE_SHIPPING')
        continue;

      applied.push({
        source: 'PROMOTION',
        label: promo.code ?? `Promotion #${promo.id}`,
        amount,
        freeShipping: promo.valueType === 'FREE_SHIPPING' || undefined,
      });
    }
    return applied;
  }

  private async couponDiscount(
    code: string,
    lines: PricedLine[],
    subTotal: DecimalValue,
    customerId?: number,
  ): Promise<AppliedDiscount | string> {
    const coupon = await this.prisma.client.discount.findUnique({
      where: { code },
      include: { products: true, categories: true, customers: true },
    });

    if (!coupon || coupon.type !== 'COUPON' || coupon.status !== 'PUBLISHED') {
      return 'Invalid coupon code';
    }
    if (!this.isWithinWindow(coupon)) return 'Coupon is not currently active';
    if (this.isExhausted(coupon)) return 'Coupon usage limit reached';
    if (coupon.minOrderAmount && subTotal.lessThan(coupon.minOrderAmount)) {
      return `Minimum order amount is ${coupon.minOrderAmount.toString()}`;
    }

    if (coupon.customers.length > 0) {
      if (
        !customerId ||
        !coupon.customers.some((c) => c.customerId === customerId)
      ) {
        return 'Coupon is not available for this account';
      }
    }
    if (coupon.maxUsesPerCustomer && customerId) {
      const used = await this.prisma.client.discountRedemption.count({
        where: { discountId: coupon.id, customerId },
      });
      if (used >= coupon.maxUsesPerCustomer) {
        return 'You have already used this coupon the maximum number of times';
      }
    }

    const eligibleBase = await this.eligibleBase(coupon, lines, subTotal);
    if (eligibleBase.lessThanOrEqualTo(0)) {
      return 'Coupon does not apply to any item in the cart';
    }

    return {
      source: 'COUPON',
      label: coupon.code!,
      amount: this.computeAmount(coupon, eligibleBase),
      freeShipping: coupon.valueType === 'FREE_SHIPPING' || undefined,
    };
  }

  // The base amount a discount's percentage/cap applies to: whole cart when
  // unscoped, otherwise only the lines matching its product/category scope.
  private async eligibleBase(
    discount: Discount & {
      products: { productId: number }[];
      categories: { categoryId: number }[];
    },
    lines: PricedLine[],
    subTotal: DecimalValue,
  ): Promise<DecimalValue> {
    if (discount.products.length === 0 && discount.categories.length === 0) {
      return subTotal;
    }

    const scopedProductIds = new Set(discount.products.map((p) => p.productId));
    if (discount.categories.length > 0) {
      const inCategories = await this.prisma.client.productCategory.findMany({
        where: {
          categoryId: { in: discount.categories.map((c) => c.categoryId) },
          productId: { in: lines.map((l) => l.productId) },
        },
      });
      for (const pc of inCategories) scopedProductIds.add(pc.productId);
    }

    return lines
      .filter((l) => scopedProductIds.has(l.productId))
      .reduce((sum, l) => sum.plus(l.lineTotal), new Decimal(0));
  }

  private computeAmount(discount: Discount, base: DecimalValue): DecimalValue {
    switch (discount.valueType) {
      case 'PERCENTAGE':
        // Money is always 2dp — round the discount up, in the customer's favour.
        return base
          .times(discount.value)
          .dividedBy(100)
          .toDecimalPlaces(2, Decimal.ROUND_UP);
      case 'FIXED_AMOUNT':
        return Decimal.min(discount.value, base);
      case 'FREE_SHIPPING':
        // Shipping isn't priced until checkout (B6) — amount 0 here, the
        // freeShipping flag on AppliedDiscount is what checkout consumes.
        return new Decimal(0);
    }
  }

  private isWithinWindow(discount: Discount): boolean {
    const now = new Date();
    if (discount.startsAt && now < discount.startsAt) return false;
    if (discount.endsAt && now > discount.endsAt) return false;
    return true;
  }

  private isExhausted(discount: Discount): boolean {
    return (
      discount.maxUsesTotal !== null &&
      discount.usedCount >= discount.maxUsesTotal
    );
  }

  // Upsell progress bar: highest enabled stage whose trigger is satisfied
  // wins (ladder, not cumulative — see design spec's "Pricing engine"
  // section). Its discount only counts if it beats the coupon/promotion
  // total already computed into `discounts`/`otherDiscountsTotal` — the
  // loser's entries are dropped from `discounts` (mutated in place; `price()`
  // recomputes totalDiscount from it afterward). Free shipping from the
  // matched stage always applies regardless of which side won the amount
  // comparison.
  private async applyUpsellBar(
    lines: PricedLine[],
    subTotal: DecimalValue,
    discounts: AppliedDiscount[],
    otherDiscountsTotal: DecimalValue,
  ): Promise<UpsellBarResult | null> {
    const settings = await this.upsellSettings.getSettings();
    if (!settings.enabled) return null;

    const stages = await this.prisma.client.upsellStage.findMany({
      where: { enabled: true },
      orderBy: { sortOrder: 'asc' },
    });
    if (stages.length === 0) return null;

    const itemCount =
      settings.countMode === 'DISTINCT_PRODUCTS'
        ? new Set(lines.map((l) => l.productId)).size
        : lines.reduce((sum, l) => sum + l.quantity, 0);

    const satisfied = (stage: UpsellStage) =>
      stage.triggerType === 'ITEM_COUNT'
        ? itemCount >= stage.triggerValue.toNumber()
        : subTotal.greaterThanOrEqualTo(stage.triggerValue);

    let matched: UpsellStage | null = null;
    for (const stage of stages) {
      if (satisfied(stage)) matched = stage;
    }

    if (matched) {
      let stageAmount = new Decimal(0);
      if (matched.discountPercent) {
        stageAmount = subTotal
          .times(matched.discountPercent)
          .dividedBy(100)
          .toDecimalPlaces(2, Decimal.ROUND_UP);
      } else if (matched.discountFixedAmount) {
        stageAmount = Decimal.min(matched.discountFixedAmount, subTotal);
      }
      if (settings.maxDiscountCap !== null) {
        stageAmount = Decimal.min(stageAmount, new Decimal(settings.maxDiscountCap));
      }

      if (stageAmount.greaterThan(otherDiscountsTotal)) {
        discounts.length = 0;
        discounts.push({
          source: 'UPSELL',
          label: matched.label,
          amount: stageAmount,
          freeShipping: matched.freeShipping || undefined,
        });
      } else if (matched.freeShipping && !discounts.some((d) => d.freeShipping)) {
        discounts.push({ source: 'UPSELL', label: matched.label, amount: new Decimal(0), freeShipping: true });
      }
    }

    const nextStage = stages.find((s) => !satisfied(s));
    return {
      stages: stages.map((s) => ({
        label: s.label,
        triggerType: s.triggerType,
        triggerValue: s.triggerValue.toString(),
        unlocked: satisfied(s),
      })),
      currentCount: itemCount.toString(),
      nextStage: nextStage
        ? {
            label: nextStage.label,
            triggerType: nextStage.triggerType,
            remaining:
              nextStage.triggerType === 'ITEM_COUNT'
                ? String(Math.max(0, nextStage.triggerValue.toNumber() - itemCount))
                : Decimal.max(nextStage.triggerValue.minus(subTotal), new Decimal(0)).toString(),
          }
        : null,
    };
  }
}
