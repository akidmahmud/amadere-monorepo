import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";
import type { PublishStatus } from "@/hooks/useBrands";

export type AdminPage = Omit<components["schemas"]["AdminPageDto"], "status"> & { status: PublishStatus };
export type PageInput = Omit<components["schemas"]["CreatePageDto"], "status"> & { status: PublishStatus };

type Paginated<T> = { items?: T[]; total?: number };
const KEY = ["admin-pages"];

export function usePages(q?: string) {
  return useQuery({
    queryKey: [...KEY, q],
    queryFn: async () => {
      const url = `/admin/pages?pageSize=100${q ? `&q=${encodeURIComponent(q)}` : ""}`;
      const res = await proxyFetch<Paginated<AdminPage>>(url);
      return res.items ?? [];
    },
    // Typing changes the query key, and without this every keystroke dropped
    // back to `isLoading` with no data -- the whole list was replaced by the
    // loading card and the page appeared to reload on each character. Keeping
    // the previous results on screen while the next ones arrive is what makes
    // it read as filtering rather than re-navigating.
    placeholderData: keepPreviousData,
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

/**
 * Bulk publish / unpublish. There is no bulk endpoint, so this is N PATCHes
 * fired together — fine at this catalogue's size, and it reuses the exact
 * same route (and therefore the same validation) as saving one page.
 *
 * `Promise.allSettled`, not `all`: one page failing must not abandon the rest
 * half-applied. The caller is told how many of each there were.
 */
export function useSetPagesStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { ids: number[]; status: "PUBLISHED" | "DRAFT" }) => {
      const results = await Promise.allSettled(
        input.ids.map((id) =>
          proxyFetch<AdminPage>(`/admin/pages/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ status: input.status }),
          }),
        ),
      );
      return {
        succeeded: results.filter((r) => r.status === "fulfilled").length,
        failed: results.filter((r) => r.status === "rejected").length,
      };
    },
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
