import { useQuery } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { OverviewRange } from "./useNetProfitOverview";

export interface ReturnedSummary {
  shipped: number;
  returned: number;
  returnRate: number;
  returnedValue: string;
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

export function useReturnedOrders(range: OverviewRange) {
  return useQuery({
    queryKey: ["net-profit-returned-orders", range],
    queryFn: () => proxyFetch<ReturnedOrdersReport>(`/admin/net-profit/overview/returned?range=${range}`),
  });
}

export function returnedOrdersExportUrl(range: OverviewRange) {
  return `/api/backend/admin/net-profit/overview/returned/export?range=${range}`;
}
