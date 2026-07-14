import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";
import type { PublishStatus } from "@/hooks/useBrands";

export type AdminBundle = Omit<components["schemas"]["AdminBundleDto"], "status"> & { status: PublishStatus };
export type BundleInput = Omit<components["schemas"]["CreateProductBundleDto"], "status"> & { status: PublishStatus };

type Paginated<T> = { items?: T[]; total?: number };
const KEY = ["admin-product-bundles"];

export function useProductBundles() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await proxyFetch<Paginated<AdminBundle>>("/admin/product-bundles?pageSize=100");
      return res.items ?? [];
    },
  });
}

export function useProductBundle(id: number) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => proxyFetch<AdminBundle>(`/admin/product-bundles/${id}`),
    enabled: Number.isFinite(id),
  });
}

export function useCreateProductBundle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BundleInput) =>
      proxyFetch<AdminBundle>("/admin/product-bundles", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateProductBundle(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<BundleInput>) =>
      proxyFetch<AdminBundle>(`/admin/product-bundles/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteProductBundle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`/admin/product-bundles/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
