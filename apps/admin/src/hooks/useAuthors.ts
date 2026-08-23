import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";
import type { PublishStatus } from "@/hooks/useBrands";

// Same swagger enum-erasure fix as PublishStatus in useBrands (§1 of
// AGENTS.admin.md) — the generated schema types widen `status` to an empty
// object, so it's re-narrowed here.
export type AdminAuthor = Omit<components["schemas"]["AdminAuthorDto"], "status"> & { status: PublishStatus };
export type AuthorInput = Omit<components["schemas"]["CreateAuthorDto"], "status"> & { status: PublishStatus };

type Paginated<T> = { items?: T[]; total?: number };
const KEY = ["admin-authors"];

export function useAuthors() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await proxyFetch<Paginated<AdminAuthor>>("/admin/authors?pageSize=100");
      return res.items ?? [];
    },
  });
}

export function useAuthor(id: number) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => proxyFetch<AdminAuthor>(`/admin/authors/${id}`),
    enabled: Number.isFinite(id) && id > 0,
  });
}

export function useCreateAuthor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AuthorInput) => proxyFetch<AdminAuthor>("/admin/authors", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateAuthor(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<AuthorInput>) =>
      proxyFetch<AdminAuthor>(`/admin/authors/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteAuthor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`/admin/authors/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
