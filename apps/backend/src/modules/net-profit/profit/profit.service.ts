import { Injectable, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma } from '@amader/db';
import { PaginatedResult } from '@amader/shared';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { paginationArgs, toPaginatedResult } from '../../../common/pagination.util';
import { NetProfitSettingsService } from '../settings/net-profit-settings.service';
import { ORDER_STATUS_CHANGED_EVENT } from '../../orders/orders.events';
import type { OrderStatusChangedEvent } from '../../orders/orders.events';
import { OrderProfitDto, toOrderProfitDto } from './profit.mapper';

const Decimal = Prisma.Decimal;

export interface ProductCostRow {
  id: number;
  slug: string;
  name: string;
  price: string | null;
  salePrice: string | null;
  costPerItem: string | null;
  variantCount: number;
  thumbnailUrl: string | null;
}

export interface ProductVariantCostRow {
  id: number;
  productId: number;
  productName: string;
  sku: string | null;
  price: string;
  salePrice: string | null;
  costPerItem: string | null;
  swatchImageUrl: string | null;
  swatchColorHex: string | null;
}

export interface ProfitReport {
  orderCount: number;
  revenue: string;
  cogs: string;
  shipping: string;
  fees: string;
  adSpend: string;
  netProfit: string;
  marginPercent: number;
}

// Backwards-calculated buy price when a product has no real cost set
// (Profit parity — the plugin's wpfok_fallback_profit_* options). Disabled
// by default: an unset cost silently means ৳0 COGS until an admin opts in,
// same fail-closed-by-default posture as every other Net Profit toggle.
export interface FallbackProfitSettings {
  enabled: boolean;
  type: 'percentage' | 'fixed';
  value: number;
}

const FALLBACK_PROFIT_DEFAULTS: FallbackProfitSettings = { enabled: false, type: 'percentage', value: 20 };

function fallbackCost(sellPrice: Prisma.Decimal, settings: FallbackProfitSettings): Prisma.Decimal | null {
  if (!settings.enabled || sellPrice.lessThanOrEqualTo(0)) return null;
  if (settings.type === 'percentage') {
    return sellPrice.times(new Decimal(1).minus(new Decimal(settings.value).dividedBy(100)));
  }
  return Decimal.max(0, sellPrice.minus(settings.value));
}

// Landed-cost input reuses the existing Product.costPerItem/
// ProductVariant.costPerItem columns (§7.10, extended for per-variation
// cost — confirmed against the real schema before building this; no new
// ProductCost table). Computed on order COMPLETED and on demand/backfill
// (this listener + the admin "recompute" action), never live-queried —
// snapshotted to OrderProfit so a later cost change doesn't silently
// rewrite history until someone explicitly recomputes.
@Injectable()
export class ProfitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: NetProfitSettingsService,
  ) {}

  async getFallbackSettings(): Promise<FallbackProfitSettings> {
    return this.settings.getNamespace('fallback_profit', FALLBACK_PROFIT_DEFAULTS);
  }

  async updateFallbackSettings(dto: Partial<FallbackProfitSettings>): Promise<FallbackProfitSettings> {
    await this.settings.setNamespace('fallback_profit', dto);
    return this.getFallbackSettings();
  }

  // Reused by SalesReportService's "profit per unit" column so both
  // surfaces resolve cost the same way (real cost, else the fallback
  // estimate) instead of drifting apart.
  async resolveProductUnitCost(productId: number, sellPrice: Prisma.Decimal): Promise<Prisma.Decimal | null> {
    const product = await this.prisma.client.product.findUnique({ where: { id: productId }, select: { costPerItem: true } });
    if (product?.costPerItem) return product.costPerItem;
    const fallbackSettings = await this.getFallbackSettings();
    return fallbackCost(sellPrice, fallbackSettings);
  }

  @OnEvent(ORDER_STATUS_CHANGED_EVENT)
  async onOrderStatusChanged(event: OrderStatusChangedEvent): Promise<void> {
    if (event.to !== 'COMPLETED') return;
    await this.computeForOrder(event.orderId);
  }

  async computeForOrder(orderId: number): Promise<OrderProfitDto> {
    const order = await this.prisma.client.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const fallbackSettings = await this.getFallbackSettings();
    let cogs = new Decimal(0);
    let hasEstimatedCost = false;

    for (const item of order.items) {
      if (!item.productId) continue;

      let unitCost: Prisma.Decimal | null = null;
      if (item.variantId) {
        const variant = await this.prisma.client.productVariant.findUnique({
          where: { id: item.variantId },
          select: { costPerItem: true },
        });
        unitCost = variant?.costPerItem ?? null;
      }
      if (!unitCost) {
        const product = await this.prisma.client.product.findUnique({
          where: { id: item.productId },
          select: { costPerItem: true },
        });
        unitCost = product?.costPerItem ?? null;
      }
      if (!unitCost) {
        unitCost = fallbackCost(item.unitPrice, fallbackSettings);
        if (unitCost) hasEstimatedCost = true;
      }

      if (unitCost) cogs = cogs.plus(unitCost.times(item.quantity));
    }

    const existing = await this.prisma.client.orderProfit.findUnique({ where: { orderId } });
    const fees = existing?.fees ?? new Decimal(0);
    const adSpend = existing?.adSpend ?? new Decimal(0);
    const revenue = order.totalAmount;
    const shipping = order.shippingAmount;
    const netProfit = revenue.minus(cogs).minus(shipping).minus(fees).minus(adSpend);

    const row = await this.prisma.client.orderProfit.upsert({
      where: { orderId },
      create: { orderId, revenue, cogs, shipping, fees, adSpend, netProfit, hasEstimatedCost },
      update: { revenue, cogs, shipping, netProfit, hasEstimatedCost, computedAt: new Date() },
    });
    return toOrderProfitDto(row);
  }

  async setAdSpend(orderId: number, adSpend: Prisma.Decimal): Promise<OrderProfitDto> {
    const existing = await this.prisma.client.orderProfit.findUnique({ where: { orderId } });
    if (!existing) throw new NotFoundException('Profit has not been computed for this order yet');

    const netProfit = existing.revenue.minus(existing.cogs).minus(existing.shipping).minus(existing.fees).minus(adSpend);
    const row = await this.prisma.client.orderProfit.update({
      where: { orderId },
      data: { adSpend, netProfit, computedAt: new Date() },
    });
    return toOrderProfitDto(row);
  }

  async getForOrder(orderId: number): Promise<OrderProfitDto | null> {
    const row = await this.prisma.client.orderProfit.findUnique({ where: { orderId } });
    return row ? toOrderProfitDto(row) : null;
  }

  async list(page: number, pageSize: number): Promise<PaginatedResult<OrderProfitDto>> {
    const [items, total] = await Promise.all([
      this.prisma.client.orderProfit.findMany({ orderBy: { computedAt: 'desc' }, ...paginationArgs(page, pageSize) }),
      this.prisma.client.orderProfit.count(),
    ]);
    return toPaginatedResult(items.map(toOrderProfitDto), total, page, pageSize);
  }

  async report(from?: Date, to?: Date): Promise<ProfitReport> {
    const where = {
      computedAt: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      },
    };
    const agg = await this.prisma.client.orderProfit.aggregate({
      where,
      _count: { _all: true },
      _sum: { revenue: true, cogs: true, shipping: true, fees: true, adSpend: true, netProfit: true },
    });
    const revenue = agg._sum.revenue ?? new Decimal(0);
    const netProfit = agg._sum.netProfit ?? new Decimal(0);
    return {
      orderCount: agg._count._all,
      revenue: revenue.toString(),
      cogs: (agg._sum.cogs ?? new Decimal(0)).toString(),
      shipping: (agg._sum.shipping ?? new Decimal(0)).toString(),
      fees: (agg._sum.fees ?? new Decimal(0)).toString(),
      adSpend: (agg._sum.adSpend ?? new Decimal(0)).toString(),
      netProfit: netProfit.toString(),
      marginPercent: revenue.greaterThan(0) ? Number(netProfit.dividedBy(revenue).times(100).toFixed(1)) : 0,
    };
  }

  async listProductCosts(page: number, pageSize: number, search?: string): Promise<PaginatedResult<ProductCostRow>> {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(search ? { translations: { some: { locale: 'EN', name: { contains: search, mode: 'insensitive' } } } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.product.findMany({
        where,
        select: {
          id: true,
          slug: true,
          price: true,
          salePrice: true,
          costPerItem: true,
          translations: { where: { locale: 'EN' }, take: 1 },
          _count: { select: { variants: true } },
          media: { where: { isPrimary: true }, take: 1, select: { media: { select: { url: true } } } },
        },
        orderBy: { id: 'asc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.product.count({ where }),
    ]);
    const rows: ProductCostRow[] = items.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.translations[0]?.name ?? p.slug,
      price: p.price?.toString() ?? null,
      salePrice: p.salePrice?.toString() ?? null,
      costPerItem: p.costPerItem?.toString() ?? null,
      variantCount: p._count.variants,
      thumbnailUrl: p.media[0]?.media.url ?? null,
    }));
    return toPaginatedResult(rows, total, page, pageSize);
  }

  // Batch-saves the visible page in one call (Profit parity — the plugin's
  // "Save All" button), instead of one PUT per row.
  async bulkSetProductCost(rows: { productId: number; costPerItem: number }[]): Promise<number> {
    let updated = 0;
    for (const row of rows) {
      await this.prisma.client.product.update({
        where: { id: row.productId },
        data: { costPerItem: new Decimal(row.costPerItem) },
      });
      updated++;
    }
    return updated;
  }

  async listVariantCosts(productId: number): Promise<ProductVariantCostRow[]> {
    const variants = await this.prisma.client.productVariant.findMany({
      where: { productId },
      include: {
        product: { include: { translations: { where: { locale: 'EN' }, take: 1 } } },
        attributeValues: { include: { attributeValue: true } },
      },
      orderBy: { id: 'asc' },
    });
    return variants.map((v) => {
      // The variant's "image" is really its attribute value's swatch (e.g.
      // Gold/Silver's own colorHex/imageUrl, set in Catalog → Attributes) —
      // there's no separate per-variant image field in the schema.
      const swatch = v.attributeValues.find((av) => av.attributeValue.imageUrl || av.attributeValue.colorHex)?.attributeValue;
      return {
        id: v.id,
        productId: v.productId,
        productName: v.product.translations[0]?.name ?? v.product.slug,
        sku: v.sku,
        price: v.price.toString(),
        salePrice: v.salePrice?.toString() ?? null,
        costPerItem: v.costPerItem?.toString() ?? null,
        swatchImageUrl: swatch?.imageUrl ?? null,
        swatchColorHex: swatch?.colorHex ?? null,
      };
    });
  }

  async setVariantCost(variantId: number, costPerItem: Prisma.Decimal): Promise<ProductVariantCostRow> {
    const v = await this.prisma.client.productVariant.update({
      where: { id: variantId },
      data: { costPerItem },
      include: {
        product: { include: { translations: { where: { locale: 'EN' }, take: 1 } } },
        attributeValues: { include: { attributeValue: true } },
      },
    });
    const swatch = v.attributeValues.find((av) => av.attributeValue.imageUrl || av.attributeValue.colorHex)?.attributeValue;
    return {
      id: v.id,
      productId: v.productId,
      productName: v.product.translations[0]?.name ?? v.product.slug,
      sku: v.sku,
      price: v.price.toString(),
      salePrice: v.salePrice?.toString() ?? null,
      costPerItem: v.costPerItem?.toString() ?? null,
      swatchImageUrl: swatch?.imageUrl ?? null,
      swatchColorHex: swatch?.colorHex ?? null,
    };
  }

  async setProductCost(productId: number, costPerItem: Prisma.Decimal): Promise<ProductCostRow> {
    const p = await this.prisma.client.product.update({
      where: { id: productId },
      data: { costPerItem },
      select: {
        id: true,
        slug: true,
        price: true,
        salePrice: true,
        costPerItem: true,
        translations: { where: { locale: 'EN' }, take: 1 },
        _count: { select: { variants: true } },
        media: { where: { isPrimary: true }, take: 1, select: { media: { select: { url: true } } } },
      },
    });
    return {
      id: p.id,
      slug: p.slug,
      name: p.translations[0]?.name ?? p.slug,
      price: p.price?.toString() ?? null,
      salePrice: p.salePrice?.toString() ?? null,
      costPerItem: p.costPerItem?.toString() ?? null,
      variantCount: p._count.variants,
      thumbnailUrl: p.media[0]?.media.url ?? null,
    };
  }
}
