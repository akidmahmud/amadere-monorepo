import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

// The array ORDER is the display order the storefront renders — the backend
// derives ProductRelation.position from the index, so a reorder is just a
// re-send of the same ids (see UpdateRelatedProductsDto).
export function useRelatedProducts(productId: number) {
  return useQuery({
    queryKey: ["admin-related-products", productId],
    queryFn: () => proxyFetch<number[]>(`/admin/products/${productId}/related`),
    enabled: productId > 0,
  });
}

export function useUpdateRelatedProducts(productId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (productIds: number[]) =>
      proxyFetch<number[]>(`/admin/products/${productId}/related`, {
        method: "PATCH",
        body: JSON.stringify({ productIds }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-related-products", productId] }),
  });
}
