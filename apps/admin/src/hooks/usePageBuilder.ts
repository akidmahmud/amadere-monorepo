import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export type BuilderLocale = "EN" | "BN";

/**
 * Saves the working draft. The DB is the source of truth for a layout — never
 * localStorage (plan §11) — so this goes straight to the server and the editor
 * debounces it rather than caching a second copy in the browser.
 */
export function useSaveLayout(id: number) {
  return useMutation({
    mutationFn: (args: { locale: BuilderLocale; layout: unknown }) =>
      proxyFetch<{ success: true }>(`/admin/pages/${id}/layout`, {
        method: "PATCH",
        body: JSON.stringify(args),
      }),
  });
}

/** Errors the backend's 422 returns, flattened for display. */
export interface PublishError {
  message: string;
  errors: string[];
}

/**
 * Publish. `kind` picks the endpoint, because publishing a checkout page needs
 * a different permission and the backend exposes it as its own route
 * (see the note in admin-pages.controller.ts).
 */
export function usePublishLayout(id: number, kind: "CONTENT" | "CHECKOUT") {
  const qc = useQueryClient();
  const path = kind === "CHECKOUT" ? "publish-checkout" : "publish";
  return useMutation({
    mutationFn: (args: { locale: BuilderLocale; label?: string }) =>
      proxyFetch<{ success: true }>(`/admin/pages/${id}/${path}`, {
        method: "POST",
        body: JSON.stringify(args),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-pages", id] }),
  });
}

export interface PageRevision {
  id: number;
  locale: BuilderLocale;
  label: string | null;
  createdAt: string;
  createdBy: number | null;
}

export function useRevisions(id: number, enabled = true) {
  return useQuery({
    queryKey: ["admin-pages", id, "revisions"],
    queryFn: () => proxyFetch<PageRevision[]>(`/admin/pages/${id}/revisions`),
    enabled: enabled && Number.isFinite(id),
  });
}

export function useRestoreRevision(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (revisionId: number) =>
      proxyFetch<{ success: true }>(
        `/admin/pages/${id}/revisions/${revisionId}/restore`,
        { method: "POST" },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-pages", id] }),
  });
}

export function usePreviewToken(id: number) {
  return useMutation({
    mutationFn: () =>
      proxyFetch<{ token: string }>(`/admin/pages/${id}/preview-token`, {
        method: "POST",
      }),
  });
}
