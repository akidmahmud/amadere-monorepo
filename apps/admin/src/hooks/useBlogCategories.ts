import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";
import type { PublishStatus } from "@/hooks/useBrands";

export type AdminBlogCategory = Omit<components["schemas"]["AdminBlogCategoryDto"], "status"> & {
  status: PublishStatus;
};
export type BlogCategoryInput = Omit<components["schemas"]["CreateBlogCategoryDto"], "status"> & {
  status: PublishStatus;
};

type Paginated<T> = { items?: T[]; total?: number };
const KEY = ["admin-blog-categories"];

export function useBlogCategories() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await proxyFetch<Paginated<AdminBlogCategory>>("/admin/blog-categories?pageSize=100");
      return res.items ?? [];
    },
  });
}

export function useBlogCategory(id: number) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => proxyFetch<AdminBlogCategory>(`/admin/blog-categories/${id}`),
    enabled: Number.isFinite(id),
  });
}

export function useCreateBlogCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BlogCategoryInput) =>
      proxyFetch<AdminBlogCategory>("/admin/blog-categories", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateBlogCategory(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<BlogCategoryInput>) =>
      proxyFetch<AdminBlogCategory>(`/admin/blog-categories/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteBlogCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`/admin/blog-categories/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
