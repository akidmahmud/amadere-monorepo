import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";
import type { PublishStatus } from "@/hooks/useBrands";

export type AdminBlogTag = Omit<components["schemas"]["AdminBlogTagDto"], "status"> & { status: PublishStatus };
export type BlogTagInput = Omit<components["schemas"]["CreateBlogTagDto"], "status"> & { status: PublishStatus };

type Paginated<T> = { items?: T[]; total?: number };
const KEY = ["admin-blog-tags"];

export function useBlogTags() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await proxyFetch<Paginated<AdminBlogTag>>("/admin/blog-tags?pageSize=100");
      return res.items ?? [];
    },
  });
}

export function useBlogTag(id: number) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => proxyFetch<AdminBlogTag>(`/admin/blog-tags/${id}`),
    enabled: Number.isFinite(id),
  });
}

export function useCreateBlogTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BlogTagInput) =>
      proxyFetch<AdminBlogTag>("/admin/blog-tags", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateBlogTag(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<BlogTagInput>) =>
      proxyFetch<AdminBlogTag>(`/admin/blog-tags/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteBlogTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`/admin/blog-tags/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
