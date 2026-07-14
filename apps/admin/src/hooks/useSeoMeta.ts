import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

export type SeoEntityType =
  | "PRODUCT"
  | "CATEGORY"
  | "BRAND"
  | "TAG"
  | "PRODUCT_BUNDLE"
  | "BLOG_POST"
  | "BLOG_CATEGORY"
  | "PAGE"
  | "COLLECTION";
export const SEO_ENTITY_TYPES: SeoEntityType[] = [
  "PRODUCT",
  "CATEGORY",
  "BRAND",
  "TAG",
  "PRODUCT_BUNDLE",
  "BLOG_POST",
  "BLOG_CATEGORY",
  "PAGE",
  "COLLECTION",
];

export type SeoMeta = components["schemas"]["SeoMetaDto"];
export type SeoMetaInput = components["schemas"]["UpsertSeoMetaDto"];

// Entity-scoped, not a browsable list — the backend has no "list all SEO
// records" endpoint, only get/upsert/delete for one (entityType, entityId,
// locale) tuple at a time. This is a lookup/edit utility, not a table view.
export function useSeoMeta(entityType: SeoEntityType, entityId: number, locale: "EN" | "BN", enabled: boolean) {
  return useQuery({
    queryKey: ["admin-seo-meta", entityType, entityId, locale],
    queryFn: () =>
      proxyFetch<SeoMeta>(`/admin/seo-meta?entityType=${entityType}&entityId=${entityId}&locale=${locale}`),
    enabled,
    retry: false,
  });
}

export function useUpsertSeoMeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SeoMetaInput) =>
      proxyFetch<SeoMeta>("/admin/seo-meta", { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-seo-meta"] }),
  });
}

export function useDeleteSeoMeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entityType, entityId, locale }: { entityType: SeoEntityType; entityId: number; locale: "EN" | "BN" }) =>
      proxyFetch<void>(`/admin/seo-meta?entityType=${entityType}&entityId=${entityId}&locale=${locale}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-seo-meta"] }),
  });
}
