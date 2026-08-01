import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

// status is read-only here and its real enum values were erased by the
// usual swagger gap — displayed as a raw string rather than guessing at an
// unverified literal union.
export type NewsletterSubscriber = Omit<components["schemas"]["NewsletterSubscriberDto"], "status"> & {
  status: string;
};

export type NewsletterListFilters = {
  q?: string;
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
