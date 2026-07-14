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

export interface InventoryList {
  items: InventoryRow[];
  total: number;
  page: number;
  pageSize: number;
  lowStockThreshold: number;
}

const KEY = ["net-profit-inventory"];

export function useInventory(filter: InventoryFilter) {
  return useQuery({
    queryKey: [...KEY, filter],
    queryFn: () => proxyFetch<InventoryList>(`/admin/net-profit/overview/inventory?filter=${filter}&pageSize=100`),
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
