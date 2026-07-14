import { Injectable, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma } from '@amader/db';
import { PaginatedResult } from '@amader/shared';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { paginationArgs, toPaginatedResult } from '../../../common/pagination.util';
import { ORDER_STATUS_CHANGED_EVENT } from '../../orders/orders.events';
import type { OrderStatusChangedEvent } from '../../orders/orders.events';
import { OrderProfitDto, toOrderProfitDto } from './profit.mapper';

const Decimal = Prisma.Decimal;

export interface ProductCostRow {
  id: number;
  slug: string;
  name: string;
  price: string | null;
  costPerItem: string | null;
}

export interface ProfitReport {
  orderCount: number;
  revenue: string;
  cogs: string;
  shipping: string;
  fees: string;
  adSpend: string;
  netProfit: string;
}

// Landed-cost input reuses the existing Product.costPerItem column (§7.10 —
// confirmed against the real schema before building this; no new
// ProductCost table). Computed on order COMPLETED and on demand/backfill
// (this listener + the admin "recompute" action), never live-queried —
// snapshotted to OrderProfit so a later cost change doesn't silently
// rewrite history until someone explicitly recomputes.
@Injectable()
export class ProfitService {
  constructor(private readonly prisma: PrismaService) {}

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

    let cogs = new Decimal(0);
    for (const item of order.items) {
      if (!item.productId) continue;
      const product = await this.prisma.client.product.findUnique({
        where: { id: item.productId },
        select: { costPerItem: true },
      });
      if (product?.costPerItem) cogs = cogs.plus(product.costPerItem.times(item.quantity));
    }

    const existing = await this.prisma.client.orderProfit.findUnique({ where: { orderId } });
    const fees = existing?.fees ?? new Decimal(0);
    const adSpend = existing?.adSpend ?? new Decimal(0);
    const revenue = order.totalAmount;
    const shipping = order.shippingAmount;
    const netProfit = revenue.minus(cogs).minus(shipping).minus(fees).minus(adSpend);

    const row = await this.prisma.client.orderProfit.upsert({
      where: { orderId },
      create: { orderId, revenue, cogs, shipping, fees, adSpend, netProfit },
      update: { revenue, cogs, shipping, netProfit, computedAt: new Date() },
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
    return {
      orderCount: agg._count._all,
      revenue: (agg._sum.revenue ?? new Decimal(0)).toString(),
      cogs: (agg._sum.cogs ?? new Decimal(0)).toString(),
      shipping: (agg._sum.shipping ?? new Decimal(0)).toString(),
      fees: (agg._sum.fees ?? new Decimal(0)).toString(),
      adSpend: (agg._sum.adSpend ?? new Decimal(0)).toString(),
      netProfit: (agg._sum.netProfit ?? new Decimal(0)).toString(),
    };
  }

  async listProductCosts(page: number, pageSize: number): Promise<PaginatedResult<ProductCostRow>> {
    const [items, total] = await Promise.all([
      this.prisma.client.product.findMany({
        where: { deletedAt: null },
        select: { id: true, slug: true, price: true, costPerItem: true, translations: { where: { locale: 'EN' }, take: 1 } },
        orderBy: { id: 'asc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.product.count({ where: { deletedAt: null } }),
    ]);
    const rows: ProductCostRow[] = items.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.translations[0]?.name ?? p.slug,
      price: p.price?.toString() ?? null,
      costPerItem: p.costPerItem?.toString() ?? null,
    }));
    return toPaginatedResult(rows, total, page, pageSize);
  }

  async setProductCost(productId: number, costPerItem: Prisma.Decimal): Promise<ProductCostRow> {
    const p = await this.prisma.client.product.update({
      where: { id: productId },
      data: { costPerItem },
      select: { id: true, slug: true, price: true, costPerItem: true, translations: { where: { locale: 'EN' }, take: 1 } },
    });
    return {
      id: p.id,
      slug: p.slug,
      name: p.translations[0]?.name ?? p.slug,
      price: p.price?.toString() ?? null,
      costPerItem: p.costPerItem?.toString() ?? null,
    };
  }
}
