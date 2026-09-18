import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CostPriceUnit, Prisma } from '@amader/db';
import type { ProductCostHistory } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { lineUnitCost } from '../net-profit/order-manager/order-csv';
import { dhakaDate } from './dhaka-date';

export interface CostHistoryRow {
  id: number;
  productId: number;
  variantId: number | null;
  cost: string;
  costPriceUnit: CostPriceUnit | null;
  effectiveFrom: string;
  confirmed: boolean;
  createdAt: string;
}

export interface AddCostInput {
  productId: number;
  variantId?: number | null;
  cost: number;
  costPriceUnit?: CostPriceUnit | null;
  effectiveFrom?: string;
  confirmed?: boolean;
}

export interface CostResolver {
  resolve(
    line: {
      productId: number | null;
      variantId: number | null;
      unitWeightKg: number;
    },
    date: string,
  ): { unitCost: number; ok: boolean } | null;
}

type Row = ProductCostHistory;

const scopeOf = (productId: number, variantId?: number | null) =>
  variantId ? `v:${variantId}` : `p:${productId}`;
const day = (d: Date) => d.toISOString().slice(0, 10);
const asDate = (s: string) => new Date(`${s}T00:00:00Z`);

function toDto(r: Row): CostHistoryRow {
  return {
    id: r.id,
    productId: r.productId,
    variantId: r.variantId,
    cost: r.cost.toString(),
    costPriceUnit: r.costPriceUnit,
    effectiveFrom: day(r.effectiveFrom),
    confirmed: r.confirmed,
    createdAt: r.createdAt.toISOString(),
  };
}

/** The row active on `date` among rows of one scope, or undefined. */
function activeOn(rows: Row[], date: string): Row | undefined {
  let best: Row | undefined;
  for (const r of rows) {
    const from = day(r.effectiveFrom);
    if (from <= date && (!best || from > day(best.effectiveFrom))) best = r;
  }
  return best;
}

/**
 * The ONLY writer of product costs (spec §5). Every screen that edits a cost
 * calls this, so a change becomes a dated row instead of silently rewriting
 * every past report — and costPerItem stays mirrored to today's row so older
 * screens (profit, CSV export, variants tab) keep working unchanged.
 */
@Injectable()
export class ProductCostHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(productId: number): Promise<CostHistoryRow[]> {
    const rows = await this.prisma.client.productCostHistory.findMany({
      where: { productId },
      orderBy: [{ scopeKey: 'asc' }, { effectiveFrom: 'asc' }],
    });
    return rows.map(toDto);
  }

  async addCost(
    input: AddCostInput,
    adminId: number | null = null,
  ): Promise<CostHistoryRow> {
    if (!Number.isFinite(input.cost) || input.cost < 0)
      throw new BadRequestException('Cost must be 0 or more');
    const scopeKey = scopeOf(input.productId, input.variantId);
    const effectiveFrom = asDate(input.effectiveFrom ?? dhakaDate(new Date()));
    const data = {
      cost: new Prisma.Decimal(input.cost),
      // A rate unit only means something on a product-level cost.
      costPriceUnit: input.variantId ? null : (input.costPriceUnit ?? null),
      confirmed: input.confirmed ?? true,
    };
    const saved = await this.prisma.client.productCostHistory.upsert({
      where: { scopeKey_effectiveFrom: { scopeKey, effectiveFrom } },
      create: {
        productId: input.productId,
        variantId: input.variantId ?? null,
        scopeKey,
        effectiveFrom,
        createdBy: adminId,
        ...data,
      },
      update: data,
    });
    await this.syncCurrent(input.productId, input.variantId ?? null);
    return toDto(saved);
  }

  /** For the old cost writers: record a new dated row only when the cost actually changed. */
  async recordIfChanged(
    input: {
      productId: number;
      variantId?: number | null;
      cost: number;
      costPriceUnit?: CostPriceUnit | null;
    },
    adminId: number | null = null,
  ): Promise<void> {
    const rows = await this.prisma.client.productCostHistory.findMany({
      where: { scopeKey: scopeOf(input.productId, input.variantId) },
    });
    const current = activeOn(rows, dhakaDate(new Date()));
    const unit = input.variantId ? null : (input.costPriceUnit ?? null);
    if (
      current &&
      Number(current.cost) === input.cost &&
      current.costPriceUnit === unit
    )
      return;
    // A scope's FIRST cost covers its past orders too (the migration backfill's
    // rule), so typing a missing cost into the product form fixes history
    // instead of leaving every earlier sale "Product cost missing". Later
    // changes are dated today and never rewrite past reports.
    const effectiveFrom =
      rows.length === 0 ? await this.firstOrderDay() : undefined;
    await this.addCost(
      { ...input, costPriceUnit: unit, effectiveFrom },
      adminId,
    );
  }

  private async firstOrderDay(): Promise<string> {
    const { _min } = await this.prisma.client.order.aggregate({
      _min: { createdAt: true },
    });
    return dhakaDate(_min.createdAt ?? new Date());
  }

  async setConfirmed(id: number, confirmed: boolean): Promise<CostHistoryRow> {
    return toDto(
      await this.prisma.client.productCostHistory.update({
        where: { id },
        data: { confirmed },
      }),
    );
  }

  async remove(id: number): Promise<void> {
    const r = await this.prisma.client.productCostHistory.findUnique({
      where: { id },
    });
    if (!r) throw new NotFoundException('Cost row not found');
    const [before, after] = await Promise.all([
      this.prisma.client.productCostHistory.count({
        where: { scopeKey: r.scopeKey, effectiveFrom: { lt: r.effectiveFrom } },
      }),
      this.prisma.client.productCostHistory.count({
        where: { scopeKey: r.scopeKey, effectiveFrom: { gt: r.effectiveFrom } },
      }),
    ]);
    if (before === 0 && after > 0) {
      throw new BadRequestException(
        'The earliest cost cannot be removed while later costs exist',
      );
    }
    await this.prisma.client.productCostHistory.delete({ where: { id } });
    await this.syncCurrent(r.productId, r.variantId);
  }

  async loadResolver(
    productIds: number[],
    variantIds: number[],
  ): Promise<CostResolver> {
    const scopes = [
      ...productIds.map((id) => `p:${id}`),
      ...variantIds.map((id) => `v:${id}`),
    ];
    const rows = scopes.length
      ? await this.prisma.client.productCostHistory.findMany({
          where: { scopeKey: { in: scopes } },
        })
      : [];
    const byScope = new Map<string, Row[]>();
    for (const r of rows)
      byScope.set(r.scopeKey, [...(byScope.get(r.scopeKey) ?? []), r]);
    return {
      resolve(line, date) {
        if (line.variantId) {
          const v = activeOn(byScope.get(`v:${line.variantId}`) ?? [], date);
          if (v) return { unitCost: Number(v.cost), ok: v.confirmed };
        }
        if (!line.productId) return null;
        const p = activeOn(byScope.get(`p:${line.productId}`) ?? [], date);
        if (!p) return null;
        const cost = lineUnitCost(
          null,
          p.cost,
          p.costPriceUnit,
          line.unitWeightKg,
        );
        return cost === null ? null : { unitCost: cost, ok: p.confirmed };
      },
    };
  }

  /** Mirror the row active today onto costPerItem (and costPriceUnit for product-level). */
  async syncCurrent(
    productId: number,
    variantId: number | null,
  ): Promise<void> {
    const rows = await this.prisma.client.productCostHistory.findMany({
      where: { scopeKey: scopeOf(productId, variantId) },
    });
    const current = activeOn(rows, dhakaDate(new Date()));
    if (variantId) {
      await this.prisma.client.productVariant.update({
        where: { id: variantId },
        data: { costPerItem: current ? current.cost : null },
      });
    } else {
      await this.prisma.client.product.update({
        where: { id: productId },
        data: {
          costPerItem: current ? current.cost : null,
          costPriceUnit: current ? current.costPriceUnit : null,
        },
      });
    }
  }

  /** A cost dated in the future becomes "today's" at midnight Dhaka — mirror it then. */
  @Cron('5 18 * * *') // 00:05 Asia/Dhaka
  async syncDueToday(): Promise<number> {
    const due = await this.prisma.client.productCostHistory.findMany({
      where: { effectiveFrom: asDate(dhakaDate(new Date())) },
      select: { productId: true, variantId: true },
    });
    for (const r of due) await this.syncCurrent(r.productId, r.variantId);
    return due.length;
  }
}
