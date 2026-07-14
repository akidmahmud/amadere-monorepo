import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

// The swagger CLI plugin can't infer a literal union/JSON shape for bare
// enum/Json fields on a *response* DTO with no explicit @ApiProperty
// annotation (documented repeatedly in the storefront's AGENTS.web.md
// changelog) — AdminHomepageSectionDto.type/.config come out of codegen as
// `Record<string, never>`. Re-typed locally, same fix already applied on the
// storefront side, rather than touching the backend DTO for one field.
export type HomepageSectionType =
  | "HERO_BANNER"
  | "PRODUCT_COLLECTION"
  | "BANNER_STRIP"
  | "CATEGORY_SHOWCASE"
  | "BLOG_TEASER"
  | "CERTIFICATION_ROW"
  | "TESTIMONIAL_BENTO"
  | "CIRCLE_BADGE_BAR"
  | "PROMO_VIDEO"
  | "TABBED_COLLECTION_CAROUSEL"
  | "AD_BANNER";

export const HOMEPAGE_SECTION_TYPES: HomepageSectionType[] = [
  "HERO_BANNER",
  "PRODUCT_COLLECTION",
  "BANNER_STRIP",
  "CATEGORY_SHOWCASE",
  "BLOG_TEASER",
  "CERTIFICATION_ROW",
  "TESTIMONIAL_BENTO",
  "CIRCLE_BADGE_BAR",
  "PROMO_VIDEO",
  "TABBED_COLLECTION_CAROUSEL",
  "AD_BANNER",
];

export type AdminHomepageSection = Omit<components["schemas"]["AdminHomepageSectionDto"], "type" | "config"> & {
  type: HomepageSectionType;
  config: Record<string, unknown>;
};

export type HomepageSectionInput = Omit<components["schemas"]["CreateHomepageSectionDto"], "config"> & {
  config?: Record<string, unknown>;
};

const KEY = ["admin-homepage-sections"];

export function useHomepageSections() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => proxyFetch<AdminHomepageSection[]>("/admin/homepage-sections"),
  });
}

export function useHomepageSection(id: number) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => proxyFetch<AdminHomepageSection>(`/admin/homepage-sections/${id}`),
    enabled: Number.isFinite(id),
  });
}

export function useCreateHomepageSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: HomepageSectionInput) =>
      proxyFetch<AdminHomepageSection>("/admin/homepage-sections", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateHomepageSection(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<HomepageSectionInput>) =>
      proxyFetch<AdminHomepageSection>(`/admin/homepage-sections/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteHomepageSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`/admin/homepage-sections/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useReorderHomepageSections() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) =>
      proxyFetch<void>("/admin/homepage-sections/reorder", { method: "PATCH", body: JSON.stringify({ ids }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
