import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";
import type { PublishStatus } from "@/hooks/useBrands";

// `locale` on the generated translation DTO comes out as `Record<string, never>`
// — same OpenAPI-codegen quirk `status` has (an enum nested inside an array
// item type doesn't reflect correctly) — patched here the same way.
export interface AdminCategoryTranslation {
  locale: "EN" | "BN";
  name: string;
  description: string | null;
}
// productIds is declared here rather than coming from schema.d.ts: that file
// is generated from a running backend and has not been regenerated since the
// category form gained a product picker. Regenerating (`pnpm typegen`) will
// make these two additions redundant, not wrong.
export type AdminCategory = Omit<
  components["schemas"]["AdminCategoryDto"],
  "status" | "translations"
> & {
  status: PublishStatus;
  translations: AdminCategoryTranslation[];
  /** Present on the detail read only — the list does not carry it. */
  productIds?: number[];
};
export type CategoryInput = Omit<
  components["schemas"]["CreateCategoryDto"],
  "status"
> & {
  status: PublishStatus;
  /** Omit to leave a category's products untouched; an array replaces them. */
  productIds?: number[];
};

type Paginated<T> = { items?: T[]; total?: number };
const KEY = ["admin-categories"];

export function useCategories() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await proxyFetch<Paginated<AdminCategory>>(
        "/admin/categories?pageSize=100",
      );
      return res.items ?? [];
    },
  });
}

export function useCategory(id: number) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => proxyFetch<AdminCategory>(`/admin/categories/${id}`),
    enabled: Number.isFinite(id),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CategoryInput) =>
      proxyFetch<AdminCategory>("/admin/categories", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateCategory(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CategoryInput>) =>
      proxyFetch<AdminCategory>(`/admin/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

// Drag-to-reorder on the categories table. Ranks are assigned per parent
// group server-side, so this never reparents anything.
export function useReorderCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) =>
      proxyFetch<void>("/admin/categories/reorder", {
        method: "PATCH",
        body: JSON.stringify({ ids }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      proxyFetch<void>(`/admin/categories/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
