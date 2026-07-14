import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";
import type { PublishStatus } from "@/hooks/useBrands";

export type AdminCollection = Omit<components["schemas"]["AdminCollectionDto"], "status"> & { status: PublishStatus };
export type CollectionInput = Omit<components["schemas"]["CreateCollectionDto"], "status"> & { status: PublishStatus };

type Paginated<T> = { items?: T[]; total?: number };
const KEY = ["admin-collections"];

export function useCollections() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await proxyFetch<Paginated<AdminCollection>>("/admin/collections?pageSize=100");
      return res.items ?? [];
    },
  });
}

export function useCollection(id: number) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => proxyFetch<AdminCollection>(`/admin/collections/${id}`),
    enabled: Number.isFinite(id),
  });
}

export function useCreateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CollectionInput) =>
      proxyFetch<AdminCollection>("/admin/collections", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateCollection(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CollectionInput>) =>
      proxyFetch<AdminCollection>(`/admin/collections/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`/admin/collections/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
