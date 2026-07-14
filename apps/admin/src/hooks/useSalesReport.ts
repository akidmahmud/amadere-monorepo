import { useQuery } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export type SalesGroupBy = "day" | "week" | "month" | "hour" | "courier" | "area" | "payment";

export interface SalesReportRow {
  label: string;
  orders: number;
  revenue: string;
}

export interface TopProductRow {
  productId: number;
  name: string;
  quantity: number;
  revenue: string;
  profitPerUnit: string | null;
}

export function useSalesReport(groupBy: SalesGroupBy, from?: string, to?: string) {
  const params = new URLSearchParams({ groupBy });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return useQuery({
    queryKey: ["net-profit-sales-report", groupBy, from, to],
    queryFn: () => proxyFetch<SalesReportRow[]>(`/admin/net-profit/reports/sales?${params.toString()}`),
  });
}

export function useTopProducts(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return useQuery({
    queryKey: ["net-profit-top-products", from, to],
    queryFn: () => proxyFetch<TopProductRow[]>(`/admin/net-profit/reports/sales/top-products?${params.toString()}`),
  });
}
