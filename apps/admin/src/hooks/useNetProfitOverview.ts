import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export type OverviewRange = "today" | "7d" | "30d";

export interface OverviewKpis {
  revenue: string;
  netProfit: string;
  orders: number;
  avgOrderValue: string;
  deliveryChargeEarned: string;
  codRiskExposure: string;
  fraudSavings: string;
  blockedAuto: number;
  blockedManual: number;
  recentBlockedPhones: string[];
  recoveredOrders: number;
  recoveredValue: string;
  incompleteOrders: number;
  incompleteValue: string;
  otpVerified: number;
  vpnDetected: number;
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

export interface OrderStatusBreakdownRow {
  status: string;
  count: number;
  amount: string;
}

export interface HourlyPerformanceSlot {
  label: string;
  orders: number;
  revenue: string;
  isPeak: boolean;
  barWidth: number;
}

export interface NetProfitOverview {
  from: string;
  to: string;
  kpis: OverviewKpis;
  revenueVsProfit: RevenueProfitPoint[];
  ordersByRisk: OrdersByRisk[];
  orderStatusBreakdown: OrderStatusBreakdownRow[];
  hourlyPerformance: HourlyPerformanceSlot[];
}

export function useNetProfitOverview(range: OverviewRange) {
  return useQuery({
    queryKey: ["net-profit-overview", range],
    queryFn: () => proxyFetch<NetProfitOverview>(`/admin/net-profit/overview?range=${range}`),
  });
}

// Same endpoint, arbitrary from/to instead of a fixed preset — the Sales
// Report dashboard's hourly-performance grid reuses this rather than
// duplicating the backend's hour-of-day bucketing logic.
export function useNetProfitOverviewRange(from: string, to: string) {
  return useQuery({
    queryKey: ["net-profit-overview", "range", from, to],
    queryFn: () => proxyFetch<NetProfitOverview>(`/admin/net-profit/overview?from=${from}&to=${to}`),
  });
}

export function useHourlySlot() {
  return useQuery({
    queryKey: ["net-profit-hourly-slot"],
    queryFn: () => proxyFetch<{ hourlySlotHours: number }>("/admin/net-profit/overview/hourly-slot"),
  });
}

export function useSetHourlySlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (hourlySlotHours: number) =>
      proxyFetch("/admin/net-profit/overview/hourly-slot", { method: "PATCH", body: JSON.stringify({ hourlySlotHours }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["net-profit-overview"] });
      qc.invalidateQueries({ queryKey: ["net-profit-hourly-slot"] });
    },
  });
}
