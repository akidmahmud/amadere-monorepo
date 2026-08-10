import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

export type NewsletterTag = components["schemas"]["AdminNewsletterTagDto"];

const KEY = ["admin-newsletter-tags"];

export function useNewsletterTags() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => proxyFetch<NewsletterTag[]>("/admin/newsletter/tags"),
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => proxyFetch<NewsletterTag>("/admin/newsletter/tags", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`/admin/newsletter/tags/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
