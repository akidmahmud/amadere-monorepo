import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export type InventoryFilter = "all" | "low" | "out";

export interface InventoryRow {
  productId: number;
  variantId: number | null;
  slug: string;
  name: string;
  sku: string | null;
  stock: number;
  reservedStock: number;
  available: number;
  stockStatus: string;
}

export interface InventoryCounts {
  all: number;
  low: number;
  out: number;
}

export interface InventoryList {
  items: InventoryRow[];
  total: number;
  page: number;
  pageSize: number;
  lowStockThreshold: number;
  counts: InventoryCounts;
}

export interface InventoryParams {
  filter: InventoryFilter;
  search?: string;
  stockMin?: number;
  stockMax?: number;
  page?: number;
  pageSize?: number;
}

const KEY = ["net-profit-inventory"];

function toQuery(params: InventoryParams): string {
  const q = new URLSearchParams();
  q.set("filter", params.filter);
  if (params.search) q.set("search", params.search);
  if (params.stockMin !== undefined) q.set("stockMin", String(params.stockMin));
  if (params.stockMax !== undefined) q.set("stockMax", String(params.stockMax));
  q.set("page", String(params.page ?? 1));
  q.set("pageSize", String(params.pageSize ?? 25));
  return q.toString();
}

export function useInventory(params: InventoryParams) {
  return useQuery({
    queryKey: [...KEY, params],
    queryFn: () => proxyFetch<InventoryList>(`/admin/net-profit/overview/inventory?${toQuery(params)}`),
  });
}

export function useSetLowStockThreshold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lowStockThreshold: number) =>
      proxyFetch("/admin/net-profit/overview/inventory/threshold", { method: "PATCH", body: JSON.stringify({ lowStockThreshold }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateInventoryStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, variantId, stock }: { productId: number; variantId: number | null; stock: number }) =>
      variantId
        ? proxyFetch(`/admin/products/${productId}/variants/${variantId}/stock`, { method: "PATCH", body: JSON.stringify({ stock }) })
        : proxyFetch(`/admin/products/${productId}`, { method: "PATCH", body: JSON.stringify({ stock }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function inventoryExportUrl(filter: InventoryFilter) {
  return `/api/backend/admin/net-profit/overview/inventory/export?filter=${filter}`;
}
