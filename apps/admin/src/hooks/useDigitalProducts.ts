import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch, ProxyApiError } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";
import type { ApiErrorResponse } from "@amader/shared";
import { PRODUCTS_KEY, type AdminProductListItem } from "@/hooks/useProducts";

// Response shape of all three /admin/digital-products/{id}/... endpoints —
// deliberately never carries digitalFileKey (the private storage key on a
// public bucket; a leaked key is a permanent unauthenticated download link).
// See AdminDigitalFileDto on the backend for the full rationale.
export type AdminDigitalFile = components["schemas"]["AdminDigitalFileDto"];

type Paginated<T> = { items?: T[]; total?: number };

const KEY = ["admin-digital-products"];

// Same /admin/products list endpoint the Products section uses (see
// useProducts.ts), just pinned to productType=DIGITAL — a dedicated nav
// section, not a filter chip on the main Products page, per the brief.
export function useDigitalProducts(page = 1, pageSize = 20, q?: string) {
  return useQuery({
    queryKey: [...KEY, page, pageSize, q],
    queryFn: () => {
      const params = new URLSearchParams({ productType: "DIGITAL", page: String(page), pageSize: String(pageSize) });
      if (q) params.set("q", q);
      return proxyFetch<Required<Paginated<AdminProductListItem>>>(`/admin/products?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
  });
}

// Invalidates both this list and the single-product query (useProduct(id)
// from useProducts.ts) that the edit page's Digital File card reads its
// current filename/page-count/preview-range from after a mutation.
function invalidateAfterFileChange(qc: ReturnType<typeof useQueryClient>, productId: number) {
  qc.invalidateQueries({ queryKey: [...PRODUCTS_KEY, productId] });
  qc.invalidateQueries({ queryKey: KEY });
}

// Goes straight to a dedicated Route Handler, not proxyFetch — proxyFetch
// forces `Content-Type: application/json`, which breaks a FormData body's
// multipart boundary. Same fix as useUploadMedia in useMedia.ts; copied here
// rather than reused since the target URL/id param differ.
export function useUploadDigitalFile(productId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/backend/admin/digital-products/${productId}/file`, { method: "POST", body: form });
      const body = (await res.json()) as { success: true; data: AdminDigitalFile } | ApiErrorResponse;
      if (!body.success) throw new ProxyApiError(res.status, body.error.code, body.error.message);
      return body.data;
    },
    onSuccess: () => invalidateAfterFileChange(qc, productId),
  });
}

export function useDeleteDigitalFile(productId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => proxyFetch<AdminDigitalFile>(`/admin/digital-products/${productId}/file`, { method: "DELETE" }),
    onSuccess: () => invalidateAfterFileChange(qc, productId),
  });
}

// The preview is an inclusive page RANGE (e.g. 5-9), not a count from the
// front of the document. The backend re-renders from the already-stored PDF,
// so this never needs a re-upload.
export function useSetPreviewRange(productId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (range: { startPage: number; endPage: number }) =>
      proxyFetch<AdminDigitalFile>(`/admin/digital-products/${productId}/preview-range`, {
        method: "PATCH",
        body: JSON.stringify(range),
      }),
    onSuccess: () => invalidateAfterFileChange(qc, productId),
  });
}
