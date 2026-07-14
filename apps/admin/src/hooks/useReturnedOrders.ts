import { useQuery } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { OverviewRange } from "./useNetProfitOverview";

export interface ReturnedSummary {
  shipped: number;
  returned: number;
  returnRate: number;
  returnedValue: string;
  deliveryChargeEarned: string;
  returnedQuantity: number;
}

export interface ReturnTrendPoint {
  date: string;
  returned: number;
}

export interface ReturnsByCourier {
  provider: string;
  returned: number;
}

export interface ReturnReason {
  reason: string;
  count: number;
}

export interface ReturnsByProduct {
  productId: number;
  name: string;
  returnedQty: number;
  avgUnitPrice: string;
  amount: string;
}

export interface ReturnsByArea {
  division: string;
  district: string;
  returned: number;
}

export interface ReturnedOrdersReport {
  from: string;
  to: string;
  summary: ReturnedSummary;
  trend: ReturnTrendPoint[];
  byCourier: ReturnsByCourier[];
  topReasons: ReturnReason[];
  byProduct: ReturnsByProduct[];
  byArea: ReturnsByArea[];
}

export interface ReturnedOrderRow {
  orderId: number;
  orderNumber: string;
  recipientName: string;
  phone: string;
  totalAmount: string;
  quantity: number;
  returnedAt: string;
}

interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function useReturnedOrders(range: OverviewRange) {
  return useQuery({
    queryKey: ["net-profit-returned-orders", range],
    queryFn: () => proxyFetch<ReturnedOrdersReport>(`/admin/net-profit/overview/returned?range=${range}`),
  });
}

export function useReturnedOrdersList(range: OverviewRange, page: number, pageSize: number) {
  return useQuery({
    queryKey: ["net-profit-returned-orders-list", range, page, pageSize],
    queryFn: () =>
      proxyFetch<Paginated<ReturnedOrderRow>>(`/admin/net-profit/overview/returned/orders?range=${range}&page=${page}&pageSize=${pageSize}`),
  });
}

export function returnedOrdersExportUrl(range: OverviewRange) {
  return `/api/backend/admin/net-profit/overview/returned/export?range=${range}`;
}
