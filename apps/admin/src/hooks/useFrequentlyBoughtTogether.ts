import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export function useFrequentlyBoughtTogether(productId: number) {
  return useQuery({
    queryKey: ["admin-frequently-bought-together", productId],
    queryFn: () => proxyFetch<number[]>(`/admin/products/${productId}/frequently-bought-together`),
    enabled: productId > 0,
  });
}

export function useUpdateFrequentlyBoughtTogether(productId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (productIds: number[]) =>
      proxyFetch<number[]>(`/admin/products/${productId}/frequently-bought-together`, {
        method: "PATCH",
        body: JSON.stringify({ productIds }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-frequently-bought-together", productId] }),
  });
}
