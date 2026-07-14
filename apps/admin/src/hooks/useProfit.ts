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
  hasEstimatedCost: boolean;
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
  marginPercent: number;
}

export interface ProductCostRow {
  id: number;
  slug: string;
  name: string;
  price: string | null;
  salePrice: string | null;
  costPerItem: string | null;
  variantCount: number;
  thumbnailUrl: string | null;
}

export interface ProductVariantCostRow {
  id: number;
  productId: number;
  productName: string;
  sku: string | null;
  price: string;
  costPerItem: string | null;
}

export interface FallbackProfitSettings {
  enabled: boolean;
  type: "percentage" | "fixed";
  value: number;
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
const FALLBACK_SETTINGS_KEY = ["net-profit-fallback-profit-settings"];

export function useProfitOrders() {
  return useQuery({ queryKey: ORDERS_KEY, queryFn: () => proxyFetch<Paginated<OrderProfit>>("/admin/net-profit/profit/orders") });
}

export function useProfitReport(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  return useQuery({
    queryKey: [...REPORT_KEY, from, to],
    queryFn: () => proxyFetch<ProfitReport>(`/admin/net-profit/profit/report${qs ? `?${qs}` : ""}`),
  });
}

export function useProductCosts(search?: string) {
  return useQuery({
    queryKey: [...PRODUCT_COST_KEY, search],
    queryFn: () =>
      proxyFetch<Paginated<ProductCostRow>>(
        `/admin/net-profit/profit/product-cost?pageSize=50${search ? `&search=${encodeURIComponent(search)}` : ""}`,
      ),
  });
}

export function useSetProductCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, buyPrice }: { productId: number; buyPrice: number }) =>
      proxyFetch<ProductCostRow>(`/admin/net-profit/profit/product-cost/${productId}`, { method: "PUT", body: JSON.stringify({ buyPrice }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCT_COST_KEY }),
  });
}

export function useBulkSetProductCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: { productId: number; costPerItem: number }[]) =>
      proxyFetch<{ updated: number }>("/admin/net-profit/profit/product-cost/bulk", { method: "POST", body: JSON.stringify({ rows }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCT_COST_KEY }),
  });
}

export function useVariantCosts(productId: number | null) {
  return useQuery({
    queryKey: ["net-profit-variant-cost", productId],
    queryFn: () => proxyFetch<ProductVariantCostRow[]>(`/admin/net-profit/profit/product-cost/${productId}/variants`),
    enabled: productId !== null,
  });
}

export function useSetVariantCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ variantId, buyPrice }: { variantId: number; buyPrice: number }) =>
      proxyFetch<ProductVariantCostRow>(`/admin/net-profit/profit/variant-cost/${variantId}`, { method: "PUT", body: JSON.stringify({ buyPrice }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["net-profit-variant-cost"] }),
  });
}

export function useFallbackProfitSettings() {
  return useQuery({
    queryKey: FALLBACK_SETTINGS_KEY,
    queryFn: () => proxyFetch<FallbackProfitSettings>("/admin/net-profit/profit/fallback-settings"),
  });
}

export function useUpdateFallbackProfitSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<FallbackProfitSettings>) =>
      proxyFetch<FallbackProfitSettings>("/admin/net-profit/profit/fallback-settings", { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: (data) => qc.setQueryData(FALLBACK_SETTINGS_KEY, data),
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
