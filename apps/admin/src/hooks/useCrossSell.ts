import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export function useCrossSell(productId: number) {
  return useQuery({
    queryKey: ["admin-cross-sell", productId],
    queryFn: () => proxyFetch<number[]>(`/admin/products/${productId}/cross-sell`),
    enabled: productId > 0,
  });
}

export function useUpdateCrossSell(productId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (productIds: number[]) =>
      proxyFetch<number[]>(`/admin/products/${productId}/cross-sell`, {
        method: "PATCH",
        body: JSON.stringify({ productIds }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-cross-sell", productId] }),
  });
}
