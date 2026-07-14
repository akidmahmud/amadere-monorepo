import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";
import type { PublishStatus } from "@/hooks/useBrands";

export type AdminTag = Omit<components["schemas"]["AdminTagDto"], "status"> & { status: PublishStatus };
export type TagInput = Omit<components["schemas"]["CreateTagDto"], "status"> & { status: PublishStatus };

type Paginated<T> = { items?: T[]; total?: number };
const KEY = ["admin-tags"];

export function useTags() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await proxyFetch<Paginated<AdminTag>>("/admin/tags?pageSize=100");
      return res.items ?? [];
    },
  });
}

export function useTag(id: number) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => proxyFetch<AdminTag>(`/admin/tags/${id}`),
    enabled: Number.isFinite(id),
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TagInput) => proxyFetch<AdminTag>("/admin/tags", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateTag(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<TagInput>) =>
      proxyFetch<AdminTag>(`/admin/tags/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`/admin/tags/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
