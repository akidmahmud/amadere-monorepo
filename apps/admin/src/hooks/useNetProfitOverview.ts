import { useQuery } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export type OverviewRange = "today" | "7d" | "30d";

export interface OverviewKpis {
  revenue: string;
  netProfit: string;
  orders: number;
  codRiskExposure: string;
  fraudSavings: string;
  recoveredOrders: number;
  recoveredValue: string;
  smsSpend: string;
}

export interface RevenueProfitPoint {
  date: string;
  revenue: string;
  netProfit: string;
}

export interface OrdersByRisk {
  riskLevel: string;
  orders: number;
}

export interface NetProfitOverview {
  from: string;
  to: string;
  kpis: OverviewKpis;
  revenueVsProfit: RevenueProfitPoint[];
  ordersByRisk: OrdersByRisk[];
}

export function useNetProfitOverview(range: OverviewRange) {
  return useQuery({
    queryKey: ["net-profit-overview", range],
    queryFn: () => proxyFetch<NetProfitOverview>(`/admin/net-profit/overview?range=${range}`),
  });
}
