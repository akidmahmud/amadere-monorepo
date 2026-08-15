import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

export type Redirect = components["schemas"]["RedirectDto"];
export type RedirectInput = components["schemas"]["CreateRedirectDto"];

type Paginated<T> = { items?: T[]; total?: number };
const KEY = ["admin-redirects"];

export function useRedirects(q?: string) {
  return useQuery({
    queryKey: [...KEY, q],
    queryFn: async () => {
      const url = `/admin/redirects?pageSize=100${q ? `&q=${encodeURIComponent(q)}` : ""}`;
      const res = await proxyFetch<Paginated<Redirect>>(url);
      return res.items ?? [];
    },
  });
}

export function useCreateRedirect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RedirectInput) =>
      proxyFetch<Redirect>("/admin/redirects", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateRedirect(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<RedirectInput>) =>
      proxyFetch<Redirect>(`/admin/redirects/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteRedirect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`/admin/redirects/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
