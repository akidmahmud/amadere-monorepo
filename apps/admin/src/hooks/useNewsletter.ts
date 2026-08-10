import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

export type NewsletterSubscriber = components["schemas"]["NewsletterSubscriberDto"];

export interface CsvImportResult {
  imported: number;
  skipped: number;
  errors: { line: number; reason: string }[];
}

export type NewsletterListFilters = {
  q?: string;
  tagId?: number;
  page: number;
  pageSize: number;
};

const KEY = ["admin-newsletter"];

function toQueryString(filters: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== "") params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function useNewsletterSubscribers(filters: NewsletterListFilters) {
  return useQuery({
    queryKey: [...KEY, filters],
    queryFn: () =>
      proxyFetch<{ items: NewsletterSubscriber[]; total: number }>(`/admin/newsletter/subscribers${toQueryString(filters)}`),
  });
}

export function useCreateNewsletterSubscriber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; name?: string }) =>
      proxyFetch<NewsletterSubscriber>("/admin/newsletter/subscribers", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteNewsletterSubscriber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<null>(`/admin/newsletter/subscribers/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useBulkDeleteNewsletterSubscribers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) =>
      proxyFetch<{ deleted: number }>("/admin/newsletter/subscribers/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function newsletterExportHref(q: string | undefined): string {
  return `/api/backend/admin/newsletter/subscribers/export${toQueryString({ q })}`;
}

export function useAddSubscriberTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tagId }: { id: number; tagId: number }) =>
      proxyFetch<void>(`/admin/newsletter/subscribers/${id}/tags`, { method: "POST", body: JSON.stringify({ tagId }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRemoveSubscriberTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tagId }: { id: number; tagId: number }) =>
      proxyFetch<void>(`/admin/newsletter/subscribers/${id}/tags/${tagId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useImportNewsletterCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      // Dedicated route (not proxyFetch) — a multipart body must stay
      // FormData all the way through, see api/backend/.../newsletter/subscribers/import/route.ts.
      const res = await fetch("/api/backend/admin/newsletter/subscribers/import", { method: "POST", body: form });
      const body = await res.json();
      if (!body.success) throw new Error(body.error?.message ?? "Import failed");
      return body.data as CsvImportResult;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
