import { Injectable } from '@nestjs/common';
import { chargeableWeightKg, quoteShippingRule } from '@amader/shared';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  dhakaDate,
  dhakaDayEnd,
  dhakaDayStart,
} from '../../product-cost-history/dhaka-date';
import { ProductCostHistoryService } from '../../product-cost-history/product-cost-history.service';
import { ShippingRulesService } from '../../shipping-rules/shipping-rules.service';
import { spreadDiscount } from '../sales-report/report-mapping';
import type { BuildOrder } from './build';
import { retailSourceOf, wholesaleSourceOf } from './sources';

const uniq = (xs: (number | null)[]) => [
  ...new Set(xs.filter((x): x is number => x !== null)),
];
/** Qty in kg, as in the owner's sheet; an item with no weight counts 1 per unit. */
const kgOf = (unitWeight: number, qty: number) =>
  (unitWeight > 0 ? unitWeight : 1) * qty;
/** One row per PRODUCT (kg summed across its variants), like the sheet. */
const keyOf = (productId: number | null, name: string) =>
  productId ? `p${productId}` : `n:${name}`;

@Injectable()
export class DailyReportLoader {
  constructor(
    private readonly prisma: PrismaService,
    private readonly costs: ProductCostHistoryService,
    private readonly shippingRules: ShippingRulesService,
  ) {}

  async load(from: string, to: string): Promise<BuildOrder[]> {
    const db = this.prisma.client;
    const [retail, wholesale, rules] = await Promise.all([
      db.order.findMany({
        where: {
          deletedAt: null,
          status: { not: 'CANCELED' },
          createdAt: { gte: dhakaDayStart(from), lte: dhakaDayEnd(to) },
        },
        select: {
          id: true,
          channel: true,
          utmSource: true,
          referrerDomain: true,
          createdAt: true,
          discountAmount: true,
          addresses: {
            where: { type: 'SHIPPING' },
            take: 1,
            select: { district: true },
          },
          shipments: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { billedCharge: true },
          },
          items: {
            orderBy: { id: 'asc' },
            select: {
              productId: true,
              variantId: true,
              productNameSnapshot: true,
              unitPrice: true,
              quantity: true,
              restockedQuantity: true,
              variant: { select: { weightOverride: true } },
              product: { select: { shippableWeight: true } },
            },
          },
        },
      }),
      // No channel isActive filter: a deactivated channel's orders still count.
      db.wholesaleOrder.findMany({
        where: {
          status: { not: 'CANCELLED' },
          cancelledAt: null,
          placedAt: {
            gte: new Date(`${from}T00:00:00Z`),
            lte: new Date(`${to}T00:00:00Z`),
          },
        },
        select: {
          id: true,
          type: true,
          channelId: true,
          placedAt: true,
          discount: true,
          deliveryCharge: true,
          items: {
            orderBy: { id: 'asc' },
            select: {
              productId: true,
              variantId: true,
              nameSnapshot: true,
              quantity: true,
              lineTotal: true,
              product: { select: { shippableWeight: true } },
            },
          },
        },
      }),
      this.shippingRules.getConfig(),
    ]);

    const wItems = wholesale.flatMap((w) => w.items);
    const rItems = retail.flatMap((r) => r.items);
    const [resolver, variantWeights] = await Promise.all([
      this.costs.loadResolver(
        uniq([...rItems, ...wItems].map((i) => i.productId)),
        uniq([...rItems, ...wItems].map((i) => i.variantId)),
      ),
      db.productVariant.findMany({
        where: { id: { in: uniq(wItems.map((i) => i.variantId)) } },
        select: { id: true, weightOverride: true },
      }),
    ]);
    const vWeight = new Map(
      variantWeights.map((v) => [v.id, v.weightOverride]),
    );

    const retailOrders: BuildOrder[] = retail.map((r) => {
      const grosses = r.items.map((i) => Number(i.unitPrice) * i.quantity);
      const discs = spreadDiscount(grosses, Number(r.discountAmount));
      const date = dhakaDate(r.createdAt);
      const isPos = r.channel === 'POS';
      let parcelKg = 0;
      const lines = r.items.flatMap((i, idx) => {
        const w = Number(
          i.variant?.weightOverride ?? i.product?.shippableWeight ?? 0,
        );
        parcelKg += w * i.quantity;
        // POS returns put goods back on the shelf: only the kept quantity is a
        // sale. Prorating the line (not subtracting posRefundedAmount) keeps it
        // VAT-neutral — that refund includes VAT when VAT is added on top.
        // Website returns still count as sold (spec D1).
        const qty = isPos ? i.quantity - i.restockedQuantity : i.quantity;
        if (qty <= 0) return [];
        const share = qty / i.quantity;
        const c = resolver.resolve(
          { productId: i.productId, variantId: i.variantId, unitWeightKg: w },
          date,
        );
        const name = i.productNameSnapshot || '(unnamed)';
        return [
          {
            key: keyOf(i.productId, name),
            name,
            kg: kgOf(w, qty),
            sales: (grosses[idx] - discs[idx]) * share,
            cost: c ? c.unitCost * qty : null,
          },
        ];
      });
      const billed = r.shipments[0]?.billedCharge;
      const delivery = isPos
        ? 0
        : billed != null
          ? Number(billed)
          : (quoteShippingRule(rules, {
              district: r.addresses[0]?.district,
              weightKg: chargeableWeightKg(parcelKg),
            })?.amount ?? 0);
      return {
        id: r.id,
        wholesale: false,
        source: retailSourceOf(r),
        delivery,
        lines,
      };
    });

    const wholesaleOrders: BuildOrder[] = wholesale.map((w) => {
      const grosses = w.items.map((i) => Number(i.lineTotal));
      const discs = spreadDiscount(grosses, Number(w.discount));
      const date = w.placedAt.toISOString().slice(0, 10);
      const lines = w.items.map((i, idx) => {
        const wt = Number(
          (i.variantId ? vWeight.get(i.variantId) : null) ??
            i.product?.shippableWeight ??
            0,
        );
        const c = resolver.resolve(
          { productId: i.productId, variantId: i.variantId, unitWeightKg: wt },
          date,
        );
        const name = i.nameSnapshot || '(unnamed)';
        return {
          key: keyOf(i.productId, name),
          name,
          kg: kgOf(wt, i.quantity),
          sales: grosses[idx] - discs[idx],
          cost: c ? c.unitCost * i.quantity : null,
        };
      });
      return {
        id: w.id,
        wholesale: true,
        source: wholesaleSourceOf(w),
        // The shop's own sheet shows wholesale delivery as 0: the buyer pays
        // deliveryCharge on the invoice (total = subtotal + delivery −
        // discount), so it is a pass-through, not a cost to the business.
        delivery: 0,
        lines,
      };
    });

    return [...retailOrders, ...wholesaleOrders];
  }
}
