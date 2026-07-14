import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export interface OrderProfit {
  id: number;
  orderId: number;
  revenue: string;
  cogs: string;
  shipping: string;
  fees: string;
  adSpend: string;
  netProfit: string;
  computedAt: string;
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

export interface ProductCostRow {
  id: number;
  slug: string;
  name: string;
  price: string | null;
  costPerItem: string | null;
}

interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

const ORDERS_KEY = ["net-profit-profit-orders"];
const REPORT_KEY = ["net-profit-profit-report"];
const PRODUCT_COST_KEY = ["net-profit-product-cost"];

export function useProfitOrders() {
  return useQuery({ queryKey: ORDERS_KEY, queryFn: () => proxyFetch<Paginated<OrderProfit>>("/admin/net-profit/profit/orders") });
}

export function useProfitReport() {
  return useQuery({ queryKey: REPORT_KEY, queryFn: () => proxyFetch<ProfitReport>("/admin/net-profit/profit/report") });
}

export function useProductCosts() {
  return useQuery({ queryKey: PRODUCT_COST_KEY, queryFn: () => proxyFetch<Paginated<ProductCostRow>>("/admin/net-profit/profit/product-cost?pageSize=50") });
}

export function useSetProductCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, buyPrice }: { productId: number; buyPrice: number }) =>
      proxyFetch<ProductCostRow>(`/admin/net-profit/profit/product-cost/${productId}`, { method: "PUT", body: JSON.stringify({ buyPrice }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCT_COST_KEY }),
  });
}

export function useRecomputeProfit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: number) => proxyFetch<OrderProfit>(`/admin/net-profit/profit/orders/${orderId}/recompute`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ORDERS_KEY });
      qc.invalidateQueries({ queryKey: REPORT_KEY });
    },
  });
}
