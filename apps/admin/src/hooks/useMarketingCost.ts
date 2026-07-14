import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export interface MarketingCost {
  id: number;
  costDate: string;
  adsCost: string;
  otherCost: string;
  note: string | null;
  autoCarried: boolean;
}

export interface DailyProfitCache {
  reportDate: string;
  totalRevenue: string;
  totalBuyCost: string;
  totalAdsCost: string;
  totalOther: string;
  totalShipping: string;
  netProfit: string;
  orderCount: number;
  computedAt: string;
}

export interface MarketingCostSettings {
  autoCarryEnabled: boolean;
  defaultMarketingCost: number;
  autoReportEnabled: boolean;
  reportEmail: string;
}

const MARKETING_COST_KEY = ["net-profit-marketing-cost"];
const DAILY_PROFIT_KEY = ["net-profit-daily-profit"];
const SETTINGS_KEY = ["net-profit-marketing-cost-settings"];

function last30DaysRange() {
  const to = new Date();
  const from = new Date(to.getTime() - 29 * 86_400_000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function useMarketingCosts() {
  const { from, to } = last30DaysRange();
  return useQuery({
    queryKey: [...MARKETING_COST_KEY, from, to],
    queryFn: () => proxyFetch<MarketingCost[]>(`/admin/net-profit/marketing-cost?from=${from}&to=${to}`),
  });
}

export function useSetMarketingCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ date, adsCost, otherCost, note }: { date: string; adsCost: number; otherCost: number; note?: string }) =>
      proxyFetch<MarketingCost>(`/admin/net-profit/marketing-cost/${date}`, { method: "PUT", body: JSON.stringify({ adsCost, otherCost, note }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MARKETING_COST_KEY });
      qc.invalidateQueries({ queryKey: DAILY_PROFIT_KEY });
    },
  });
}

export function useDailyProfitCache(fromDate?: string, toDate?: string) {
  const fallback = last30DaysRange();
  const from = fromDate ?? fallback.from;
  const to = toDate ?? fallback.to;
  return useQuery({
    queryKey: [...DAILY_PROFIT_KEY, from, to],
    queryFn: () => proxyFetch<DailyProfitCache[]>(`/admin/net-profit/daily-profit?from=${from}&to=${to}`),
  });
}

export function useMarketingCostSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => proxyFetch<MarketingCostSettings>("/admin/net-profit/marketing-cost/settings"),
  });
}

export function useUpdateMarketingCostSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<MarketingCostSettings>) =>
      proxyFetch<MarketingCostSettings>("/admin/net-profit/marketing-cost/settings", { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: (data) => qc.setQueryData(SETTINGS_KEY, data),
  });
}
