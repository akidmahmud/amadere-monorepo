import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

// Same swagger enum-erasure fix as HomepageSectionType (§1 of AGENTS.admin.md)
export type PublishStatus = "DRAFT" | "PENDING" | "PUBLISHED" | "ARCHIVED";
export const PUBLISH_STATUSES: PublishStatus[] = ["DRAFT", "PENDING", "PUBLISHED", "ARCHIVED"];

export type AdminBrand = Omit<components["schemas"]["AdminBrandDto"], "status"> & { status: PublishStatus };
export type BrandInput = Omit<components["schemas"]["CreateBrandDto"], "status"> & { status: PublishStatus };

type Paginated<T> = { items?: T[]; total?: number };
const KEY = ["admin-brands"];

export function useBrands() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await proxyFetch<Paginated<AdminBrand>>("/admin/brands?pageSize=100");
      return res.items ?? [];
    },
  });
}

export function useBrand(id: number) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => proxyFetch<AdminBrand>(`/admin/brands/${id}`),
    enabled: Number.isFinite(id),
  });
}

export function useCreateBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BrandInput) => proxyFetch<AdminBrand>("/admin/brands", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateBrand(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<BrandInput>) =>
      proxyFetch<AdminBrand>(`/admin/brands/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`/admin/brands/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
