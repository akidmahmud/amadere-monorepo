import { useQuery } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export type PnlPeriod = "daily" | "weekly" | "monthly" | "custom";

export interface PnlProductRow {
  productName: string;
  qty: string;
  salesValue: string;
  avgValue: string;
  costPerKg: string;
  totalProductCost: string;
  profitByProduct: string;
}

export interface PnlSourceBlock {
  source: string;
  rows: PnlProductRow[];
  totals: {
    qty: string;
    salesValue: string;
    avgValue: string;
    totalProductCost: string;
    deliveryCost: string;
    profitByProduct: string;
  };
}

export interface ProductPnlReport {
  from: string;
  to: string;
  sources: PnlSourceBlock[];
  grandTotal: {
    qty: string;
    salesValue: string;
    avgValue: string;
    totalProductCost: string;
    deliveryCost: string;
    profitByProduct: string;
    marketingCost: string;
    netProfit: string;
  };
}

export function useProductPnl(
  period: PnlPeriod,
  from?: string,
  to?: string,
  enabled = true,
) {
  const params = new URLSearchParams({ period });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return useQuery({
    queryKey: ["product-pnl", period, from, to],
    // A custom range with neither end set is rejected by the API, so the
    // caller holds the query back until one is chosen.
    enabled,
    queryFn: () =>
      proxyFetch<ProductPnlReport>(
        `/admin/net-profit/reports/sales/pnl?${params.toString()}`,
      ),
  });
}
