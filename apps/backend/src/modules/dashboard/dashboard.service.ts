import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DashboardOverviewDto } from './dashboard.dto';

const NON_CANCELED = { not: 'CANCELED' as const };

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(): Promise<DashboardOverviewDto> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      revenueAgg,
      totalOrders,
      totalCustomers,
      totalProducts,
      completedOrders,
      completedAgg,
      pendingAgg,
      todayAgg,
      statusGroups,
      channelGroups,
      recentOrdersRaw,
      revenueOrders,
      itemsRaw,
      customerSpendRaw,
    ] = await Promise.all([
      this.prisma.client.order.aggregate({
        where: { status: NON_CANCELED },
        _sum: { totalAmount: true },
      }),
      this.prisma.client.order.count(),
      this.prisma.client.customer.count(),
      this.prisma.client.product.count(),
      this.prisma.client.order.count({ where: { status: 'COMPLETED' } }),
      this.prisma.client.order.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { totalAmount: true },
      }),
      this.prisma.client.order.aggregate({
        where: { status: 'PENDING' },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.client.order.aggregate({
        where: { createdAt: { gte: startOfToday } },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.client.order.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.client.order.groupBy({ by: ['channel'], _count: { _all: true } }),
      this.prisma.client.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          status: true,
          createdAt: true,
          customer: { select: { firstName: true, lastName: true } },
          payments: { orderBy: { createdAt: 'desc' }, take: 1, select: { provider: true } },
        },
      }),
      this.prisma.client.order.findMany({
        where: { status: NON_CANCELED },
        select: { totalAmount: true, createdAt: true },
      }),
      this.prisma.client.orderItem.findMany({
        where: { order: { status: NON_CANCELED }, productId: { not: null } },
        select: {
          productId: true,
          quantity: true,
          unitPrice: true,
          productNameSnapshot: true,
          product: { select: { slug: true } },
        },
      }),
      this.prisma.client.order.groupBy({
        by: ['customerId'],
        where: { status: NON_CANCELED, customerId: { not: null } },
        _sum: { totalAmount: true },
        _count: { _all: true },
        orderBy: { _sum: { totalAmount: 'desc' } },
        take: 5,
      }),
    ]);

    // Bucket revenue by calendar month (real order history, not synthetic
    // weeks — the migrated data spans ~10 real months). "previousRevenue"
    // is the prior chronological month's real revenue, not a fake compare.
    const monthBuckets = new Map<string, number>();
    for (const o of revenueOrders) {
      const key = `${o.createdAt.getFullYear()}-${String(o.createdAt.getMonth() + 1).padStart(2, '0')}`;
      monthBuckets.set(key, (monthBuckets.get(key) ?? 0) + Number(o.totalAmount));
    }
    const sortedMonths = [...monthBuckets.keys()].sort();
    const monthlyRevenue = sortedMonths.slice(-12).map((key, i, arr) => {
      const [year, month] = key.split('-');
      const label = new Date(Number(year), Number(month) - 1, 1).toLocaleString('en', {
        month: 'short',
        year: '2-digit',
      });
      const prevKey = sortedMonths[sortedMonths.indexOf(arr[i]) - 1];
      return {
        label,
        revenue: monthBuckets.get(key)!.toFixed(2),
        previousRevenue: (prevKey ? monthBuckets.get(prevKey) : 0)!.toFixed(2),
      };
    });

    const productTotals = new Map<
      number,
      { name: string; slug: string | null; revenue: number; unitsSold: number }
    >();
    for (const item of itemsRaw) {
      if (item.productId == null) continue;
      const existing = productTotals.get(item.productId);
      const revenue = Number(item.unitPrice) * item.quantity;
      if (existing) {
        existing.revenue += revenue;
        existing.unitsSold += item.quantity;
      } else {
        productTotals.set(item.productId, {
          name: item.productNameSnapshot,
          slug: item.product?.slug ?? null,
          revenue,
          unitsSold: item.quantity,
        });
      }
    }
    const topProducts = [...productTotals.entries()]
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5)
      .map(([id, p]) => ({
        id,
        slug: p.slug ?? '',
        name: p.name,
        revenue: p.revenue.toFixed(2),
        unitsSold: p.unitsSold,
      }));

    const customerIds = customerSpendRaw
      .map((c) => c.customerId)
      .filter((id): id is number => id !== null);
    const customers = customerIds.length
      ? await this.prisma.client.customer.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const customerNameById = new Map(
      customers.map((c) => [c.id, [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Customer']),
    );
    const topCustomers = customerSpendRaw.map((c) => ({
      id: c.customerId!,
      name: customerNameById.get(c.customerId!) ?? 'Customer',
      orderCount: c._count._all,
      totalSpend: (c._sum.totalAmount ?? 0).toString(),
    }));

    const totalRevenue = revenueAgg._sum.totalAmount ?? 0;

    return {
      totalRevenue: totalRevenue.toString(),
      totalOrders,
      totalCustomers,
      totalProducts,
      completedOrderRate: totalOrders > 0 ? completedOrders / totalOrders : 0,
      avgOrderValue: totalOrders > 0 ? (Number(totalRevenue) / totalOrders).toFixed(2) : '0.00',
      today: {
        orders: todayAgg._count._all,
        revenue: (todayAgg._sum.totalAmount ?? 0).toString(),
      },
      completed: {
        orders: completedOrders,
        revenue: (completedAgg._sum.totalAmount ?? 0).toString(),
      },
      pending: {
        orders: pendingAgg._count._all,
        revenue: (pendingAgg._sum.totalAmount ?? 0).toString(),
      },
      statusBreakdown: statusGroups.map((g) => ({ status: g.status, count: g._count._all })),
      ordersByChannel: channelGroups.map((g) => ({ channel: g.channel, count: g._count._all })),
      recentOrders: recentOrdersRaw.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customer
          ? [o.customer.firstName, o.customer.lastName].filter(Boolean).join(' ') || 'Customer'
          : 'Guest',
        total: o.totalAmount.toString(),
        status: o.status,
        createdAt: o.createdAt.toISOString(),
        paymentMethod: o.payments[0]?.provider && o.payments[0].provider !== 'COD' ? 'PAID' : 'COD',
      })),
      topCustomers,
      monthlyRevenue,
      topProducts,
    };
  }
}
