import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";
import type { PublishStatus } from "@/hooks/useBrands";

export type AdminBlogPost = Omit<components["schemas"]["AdminBlogPostDto"], "status"> & { status: PublishStatus };
export type BlogPostInput = components["schemas"]["CreateBlogPostDto"];

type Paginated<T> = { items?: T[]; total?: number };
const KEY = ["admin-blog-posts"];

export interface BlogPostFilters {
  status?: PublishStatus;
  q?: string;
  categoryId?: number;
  tagId?: number;
  isFeatured?: boolean;
  page?: number;
  pageSize?: number;
}

function toQueryString(filters: BlogPostFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function useBlogPosts(filters: BlogPostFilters = {}) {
  return useQuery({
    queryKey: [...KEY, filters],
    queryFn: () => proxyFetch<Required<Paginated<AdminBlogPost>>>(`/admin/blog-posts${toQueryString(filters)}`),
  });
}

export interface BlogPostStats {
  total: number;
  published: number;
  draft: number;
  archived: number;
  featured: number;
}

export function useBlogPostStats() {
  return useQuery({
    queryKey: [...KEY, "stats"],
    queryFn: () => proxyFetch<BlogPostStats>("/admin/blog-posts/stats"),
  });
}

export function useBlogPost(id: number) {
  return useQuery({
    queryKey: [...KEY, "detail", id],
    queryFn: () => proxyFetch<AdminBlogPost>(`/admin/blog-posts/${id}`),
    enabled: Number.isFinite(id),
  });
}

export type BlogPostRevision = components["schemas"]["BlogPostRevisionDto"];

export function useBlogPostRevisions(id: number) {
  return useQuery({
    queryKey: [...KEY, "revisions", id],
    queryFn: () => proxyFetch<BlogPostRevision[]>(`/admin/blog-posts/${id}/revisions`),
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

export function useGenerateBlogPreviewToken() {
  return useMutation({
    mutationFn: (id: number) => proxyFetch<{ token: string }>(`/admin/blog-posts/${id}/preview-token`, { method: "POST" }),
  });
}

export type AdminDeletedBlogPost = components["schemas"]["AdminDeletedBlogPostDto"];

const TRASH_KEY = ["admin-blog-posts-trash"];

export function useDeletedBlogPosts(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: [...TRASH_KEY, page, pageSize],
    queryFn: () =>
      proxyFetch<Required<Paginated<AdminDeletedBlogPost>>>(`/admin/blog-posts/trash?page=${page}&pageSize=${pageSize}`),
  });
}

export function useRestoreBlogPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<AdminBlogPost>(`/admin/blog-posts/${id}/restore`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TRASH_KEY });
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
