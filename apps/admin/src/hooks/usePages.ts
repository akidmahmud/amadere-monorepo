import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";
import type { PublishStatus } from "@/hooks/useBrands";

export type AdminPage = Omit<components["schemas"]["AdminPageDto"], "status"> & { status: PublishStatus };
export type PageInput = Omit<components["schemas"]["CreatePageDto"], "status"> & { status: PublishStatus };

type Paginated<T> = { items?: T[]; total?: number };
const KEY = ["admin-pages"];

export function usePages() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await proxyFetch<Paginated<AdminPage>>("/admin/pages?pageSize=100");
      return res.items ?? [];
    },
  });
}

export function usePage(id: number) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => proxyFetch<AdminPage>(`/admin/pages/${id}`),
    enabled: Number.isFinite(id),
  });
}

export function useCreatePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PageInput) => proxyFetch<AdminPage>("/admin/pages", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdatePage(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<PageInput>) =>
      proxyFetch<AdminPage>(`/admin/pages/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeletePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`/admin/pages/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
