import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";
import type { PublishStatus } from "@/hooks/useBrands";

export type ProductType = "PHYSICAL" | "DIGITAL";
export type StockStatus = "IN_STOCK" | "OUT_OF_STOCK" | "ON_BACKORDER";

// Same swagger enum-erasure fix as every other module — productType/status/
// stockStatus on the response DTO come out as Record<string, never>.
export type AdminProduct = Omit<
  components["schemas"]["AdminProductDto"],
  "productType" | "status" | "stockStatus" | "variants"
> & {
  productType: ProductType;
  status: PublishStatus;
  stockStatus: StockStatus;
  variants: AdminProductVariant[];
};

export type AdminProductVariant = Omit<components["schemas"]["AdminProductVariantDto"], "stockStatus"> & {
  stockStatus: StockStatus;
};

export type ProductInput = Omit<components["schemas"]["CreateProductDto"], "productType" | "status" | "stockStatus"> & {
  productType: ProductType;
  status: PublishStatus;
  stockStatus: StockStatus;
};

export type VariantInput = components["schemas"]["CreateProductVariantDto"];

type Paginated<T> = { items?: T[]; total?: number };
const KEY = ["admin-products"];

export interface AdminProductFilters {
  q?: string;
  categoryIds?: number[];
  brandId?: number;
  status?: PublishStatus;
  stockStatus?: StockStatus;
  minPrice?: number;
  maxPrice?: number;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  pageSize?: number;
}

function toQueryString(filters: AdminProductFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === "") continue;
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, String(v));
    } else {
      params.set(key, String(value));
    }
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function useProducts(filters: AdminProductFilters = {}) {
  return useQuery({
    queryKey: [...KEY, filters],
    queryFn: () => proxyFetch<Required<Paginated<AdminProduct>>>(`/admin/products${toQueryString(filters)}`),
    placeholderData: keepPreviousData,
  });
}

export interface ProductSalesStats {
  unitsSold: number;
  revenue: string;
  orderCount: number;
}

export function useProductSalesStats(productId: number) {
  return useQuery({
    queryKey: [...KEY, productId, "stats"],
    queryFn: () => proxyFetch<ProductSalesStats>(`/admin/products/${productId}/stats`),
    enabled: Number.isFinite(productId),
  });
}

export interface ProductStats {
  total: number;
  active: number;
  draft: number;
  outOfStock: number;
  lowStock: number;
}

export function useProductStats() {
  return useQuery({
    queryKey: [...KEY, "stats"],
    queryFn: () => proxyFetch<ProductStats>("/admin/products/stats"),
  });
}

export function useProductSearch(q: string) {
  return useQuery({
    queryKey: [...KEY, "search", q],
    queryFn: async () => {
      const res = await proxyFetch<Paginated<AdminProduct>>(`/admin/products?pageSize=20&q=${encodeURIComponent(q)}`);
      return res.items ?? [];
    },
    enabled: q.trim().length > 0,
  });
}

export function useProduct(id: number) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => proxyFetch<AdminProduct>(`/admin/products/${id}`),
    enabled: Number.isFinite(id),
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProductInput) =>
      proxyFetch<AdminProduct>("/admin/products", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

// Deliberately never sends `variants` in the PATCH body — there's no
// documented replace-vs-merge semantics for it on update (only add/remove
// endpoints exist for individual variants), so variant changes always go
// through useAddVariant/useRemoveVariant instead, matching the one pattern
// that's actually confirmed to work (same approach as Attribute Values).
export function useUpdateProduct(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Omit<ProductInput, "variants">>) =>
      proxyFetch<AdminProduct>(`/admin/products/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`/admin/products/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useAddVariant(productId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: VariantInput) =>
      proxyFetch<AdminProduct>(`/admin/products/${productId}/variants`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRemoveVariant(productId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (variantId: number) =>
      proxyFetch<void>(`/admin/products/${productId}/variants/${variantId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateVariantSku(productId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ variantId, sku }: { variantId: number; sku: string }) =>
      proxyFetch<void>(`/admin/products/${productId}/variants/${variantId}/sku`, { method: "PATCH", body: JSON.stringify({ sku }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export { KEY as PRODUCTS_KEY };
