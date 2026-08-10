import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";
import type { EmailBlock, EmailContentJson, EmailContentMode } from "./useNewsletterCampaigns";

// Same swagger bare-JSON erasure as every other module — contentJson comes out as Record<string, never>.
export type NewsletterTemplate = Omit<components["schemas"]["AdminNewsletterTemplateDto"], "contentJson"> & {
  contentJson: EmailContentJson;
};

export interface TemplateInput {
  name: string;
  description?: string;
  blocks?: EmailBlock[];
  mode?: EmailContentMode;
  html?: string;
}

const KEY = ["admin-newsletter-templates"];

export function useNewsletterTemplates() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => proxyFetch<NewsletterTemplate[]>("/admin/newsletter/templates"),
  });
}

export function useNewsletterTemplate(id: number | null) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => proxyFetch<NewsletterTemplate>(`/admin/newsletter/templates/${id}`),
    enabled: id !== null,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TemplateInput) => proxyFetch<NewsletterTemplate>("/admin/newsletter/templates", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateTemplate(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<TemplateInput>) => proxyFetch<NewsletterTemplate>(`/admin/newsletter/templates/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`/admin/newsletter/templates/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDuplicateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<NewsletterTemplate>(`/admin/newsletter/templates/${id}/duplicate`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
