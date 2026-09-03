import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";
import { PUBLISH_STATUSES, type PublishStatus } from "@/hooks/useBrands";

/**
 * Statuses a PRODUCT can hold.
 *
 * Deliberately its own list rather than an addition to PUBLISH_STATUSES:
 * ADMIN_ONLY is implemented by the product read paths and nothing else, so
 * offering it on a brand or a blog tag would be a setting that silently does
 * nothing.
 */
export type ProductStatus = PublishStatus | "ADMIN_ONLY";
export const PRODUCT_STATUSES: ProductStatus[] = [
  ...PUBLISH_STATUSES,
  "ADMIN_ONLY",
];
export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  PUBLISHED: "Published",
  DRAFT: "Draft",
  PENDING: "Pending",
  ARCHIVED: "Archived",
  ADMIN_ONLY: "Admin only",
};

export type ProductType = "PHYSICAL" | "DIGITAL";
export type StockStatus = "IN_STOCK" | "OUT_OF_STOCK" | "ON_BACKORDER";
export type ProductFlagLabel = "BEST_SELLING" | "NEW_ARRIVAL" | "FEATURED";
export type CostPriceUnit =
  "PER_KG" | "PER_100G" | "PER_G" | "PER_LITER" | "PER_ML";

// Same swagger enum-erasure fix as every other module — productType/status/
// stockStatus/flagLabel/costPriceUnit on the response DTO come out as
// Record<string, never>.
export type AdminProduct = Omit<
  components["schemas"]["AdminProductDto"],
  | "productType"
  | "status"
  | "stockStatus"
  | "variants"
  | "flagLabel"
  | "costPriceUnit"
> & {
  productType: ProductType;
  status: ProductStatus;
  stockStatus: StockStatus;
  variants: AdminProductVariant[];
  flagLabel: ProductFlagLabel | null;
  costPriceUnit: CostPriceUnit | null;
};

export type AdminProductVariant = Omit<
  components["schemas"]["AdminProductVariantDto"],
  "stockStatus"
> & {
  stockStatus: StockStatus;
};

// Lean shape for the Products table only (PRODUCT_LIST_INCLUDE on the
// backend) — everything AdminProductDto carries that ProductsTable.tsx
// never renders (FAQs, brand/category/tag/attribute translations, every
// variant's attribute values) is dropped, since reusing the full detail
// shape here was doing 5-10x the necessary joins per row on a 20-row page.
export type AdminProductListItem = Omit<
  components["schemas"]["AdminProductListItemDto"],
  "stockStatus" | "status" | "variants"
> & {
  stockStatus: StockStatus;
  status: ProductStatus;
  variants: AdminProductListVariant[];
};

export type AdminProductListVariant = Omit<
  components["schemas"]["AdminProductListVariantDto"],
  "stockStatus"
> & {
  stockStatus: StockStatus;
};

export type ProductInput = Omit<
  components["schemas"]["CreateProductDto"],
  "productType" | "status" | "stockStatus" | "flagLabel"
> & {
  productType: ProductType;
  status: ProductStatus;
  stockStatus: StockStatus;
  flagLabel?: ProductFlagLabel | null;
};

export type VariantInput = components["schemas"]["CreateProductVariantDto"];

type Paginated<T> = { items?: T[]; total?: number };
const KEY = ["admin-products"];

export interface AdminProductFilters {
  q?: string;
  categoryIds?: number[];
  brandId?: number;
  status?: ProductStatus;
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
    queryFn: () =>
      proxyFetch<Required<Paginated<AdminProductListItem>>>(
        `/admin/products${toQueryString(filters)}`,
      ),
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
    queryFn: () =>
      proxyFetch<ProductSalesStats>(`/admin/products/${productId}/stats`),
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

// Hits the same list endpoint (and lean AdminProductListItem shape —
// flat `name`/`thumbnailUrl`, no `translations`/`media`) as useProducts()
// below, not the full AdminProductDto — see PRODUCT_LIST_INCLUDE's comment
// on products.service.ts's adminList().
export function useProductSearch(q: string) {
  return useQuery({
    queryKey: [...KEY, "search", q],
    queryFn: async () => {
      const res = await proxyFetch<Paginated<AdminProductListItem>>(
        `/admin/products?pageSize=20&q=${encodeURIComponent(q)}`,
      );
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
      proxyFetch<AdminProduct>("/admin/products", {
        method: "POST",
        body: JSON.stringify(input),
      }),
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
      proxyFetch<AdminProduct>(`/admin/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      proxyFetch<void>(`/admin/products/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDuplicateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      proxyFetch<AdminProduct>(`/admin/products/${id}/duplicate`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useAddVariant(productId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: VariantInput) =>
      proxyFetch<AdminProduct>(`/admin/products/${productId}/variants`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRemoveVariant(productId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (variantId: number) =>
      proxyFetch<void>(`/admin/products/${productId}/variants/${variantId}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Promote a variant to default. Setting one necessarily unsets the others. */
export function useSetDefaultVariant(productId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (variantId: number) =>
      proxyFetch<void>(
        `/admin/products/${productId}/variants/${variantId}/default`,
        { method: "PATCH" },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateVariantSku(productId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ variantId, sku }: { variantId: number; sku: string }) =>
      proxyFetch<void>(
        `/admin/products/${productId}/variants/${variantId}/sku`,
        { method: "PATCH", body: JSON.stringify({ sku }) },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

// Toggling a variant between staff-only and public. Its own PATCH, matching
// sku/price/stock/default, so the inline editor can flip it without a full
// product save. The backend recomputes the parent's public stock status,
// which is why this invalidates the product list on success.
// Drag-to-reorder on the products table. `startPosition` is the absolute
// index of the first id in the catalogue ((page - 1) * pageSize) -- the list
// is paginated, so a page of ids alone cannot say where it belongs globally.
export function useReorderProducts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      ids,
      startPosition,
    }: {
      ids: number[];
      startPosition: number;
    }) =>
      proxyFetch<void>("/admin/products/reorder", {
        method: "PATCH",
        body: JSON.stringify({ ids, startPosition }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateVariantAdminOnly(productId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      variantId,
      isAdminOnly,
    }: {
      variantId: number;
      isAdminOnly: boolean;
    }) =>
      proxyFetch<void>(
        `/admin/products/${productId}/variants/${variantId}/admin-only`,
        { method: "PATCH", body: JSON.stringify({ isAdminOnly }) },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateVariantWeight(productId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      variantId,
      weightOverride,
    }: {
      variantId: number;
      weightOverride: number | null;
    }) =>
      proxyFetch<void>(
        `/admin/products/${productId}/variants/${variantId}/weight`,
        {
          method: "PATCH",
          body: JSON.stringify({ weightOverride }),
        },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useGenerateProductPreviewToken() {
  return useMutation({
    mutationFn: (id: number) =>
      proxyFetch<{ token: string }>(`/admin/products/${id}/preview-token`, {
        method: "POST",
      }),
  });
}

export type AdminDeletedProduct =
  components["schemas"]["AdminDeletedProductDto"];

const TRASH_KEY = ["admin-products-trash"];

export function useDeletedProducts(page = 1, pageSize = 20, q?: string) {
  return useQuery({
    queryKey: [...TRASH_KEY, page, pageSize, q],
    queryFn: () => {
      const url = `/admin/products/trash?page=${page}&pageSize=${pageSize}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
      return proxyFetch<Required<Paginated<AdminDeletedProduct>>>(url);
    },
  });
}

export function useRestoreProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      proxyFetch<AdminProduct>(`/admin/products/${id}/restore`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TRASH_KEY });
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export { KEY as PRODUCTS_KEY };
