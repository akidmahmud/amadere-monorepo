import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";
import type { PublishStatus } from "@/hooks/useBrands";

export type AdminBlogPost = Omit<components["schemas"]["AdminBlogPostDto"], "status"> & { status: PublishStatus };
export type BlogPostInput = components["schemas"]["CreateBlogPostDto"];

type Paginated<T> = { items?: T[]; total?: number };
const KEY = ["admin-blog-posts"];

export function useBlogPosts(status?: PublishStatus) {
  return useQuery({
    queryKey: [...KEY, status ?? "all"],
    queryFn: async () => {
      const qs = new URLSearchParams({ pageSize: "100" });
      if (status) qs.set("status", status);
      const res = await proxyFetch<Paginated<AdminBlogPost>>(`/admin/blog-posts?${qs}`);
      return res.items ?? [];
    },
  });
}

export function useBlogPost(id: number) {
  return useQuery({
    queryKey: [...KEY, "detail", id],
    queryFn: () => proxyFetch<AdminBlogPost>(`/admin/blog-posts/${id}`),
    enabled: Number.isFinite(id),
  });
}

export function useCreateBlogPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BlogPostInput) =>
      proxyFetch<AdminBlogPost>("/admin/blog-posts", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateBlogPost(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<BlogPostInput>) =>
      proxyFetch<AdminBlogPost>(`/admin/blog-posts/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteBlogPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`/admin/blog-posts/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

// Editorial workflow: DRAFT -> (submit) -> PENDING -> (publish) -> PUBLISHED -> (archive) -> ARCHIVED.
// All three are no-body POSTs.
function useWorkflowAction(action: "submit" | "publish" | "archive") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<AdminBlogPost>(`/admin/blog-posts/${id}/${action}`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export const useSubmitBlogPost = () => useWorkflowAction("submit");
export const usePublishBlogPost = () => useWorkflowAction("publish");
export const useArchiveBlogPost = () => useWorkflowAction("archive");
