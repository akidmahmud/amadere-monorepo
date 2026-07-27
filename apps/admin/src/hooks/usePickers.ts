import { useQuery } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

type Paginated<T> = { items?: T[]; total?: number };

function firstTranslationLabel(
  translations: { name?: string; title?: string }[] | undefined,
  fallback: string,
): string {
  const t = translations?.[0];
  return t?.name ?? t?.title ?? fallback;
}

// Small option-list hooks for the Homepage Section editor forms — each just
// fetches a fixed-size admin list and maps it down to {id, label} for a
// <select>. Pagination isn't wired up (pageSize: 100 is a pragmatic cap for
// a picker dropdown, not a full browsing UI) — fine for this store's size,
// revisit if a picker ever needs search/pagination.

export function usePickerCollections() {
  return useQuery({
    queryKey: ["picker-collections"],
    queryFn: async () => {
      const res = await proxyFetch<Paginated<components["schemas"]["AdminCollectionDto"]>>(
        "/admin/collections?pageSize=100",
      );
      return (res.items ?? []).map((c) => ({ id: c.id, label: firstTranslationLabel(c.translations, c.slug) }));
    },
  });
}

export function usePickerCategories() {
  return useQuery({
    queryKey: ["picker-categories"],
    queryFn: async () => {
      const res = await proxyFetch<Paginated<components["schemas"]["AdminCategoryDto"]>>(
        "/admin/categories?pageSize=100",
      );
      return (res.items ?? []).map((c) => ({ id: c.id, label: firstTranslationLabel(c.translations, c.slug) }));
    },
  });
}

export function usePickerTags() {
  return useQuery({
    queryKey: ["picker-tags"],
    queryFn: async () => {
      const res = await proxyFetch<Paginated<components["schemas"]["AdminTagDto"]>>("/admin/tags?pageSize=100");
      return (res.items ?? []).map((t) => ({ id: t.id, label: firstTranslationLabel(t.translations, t.slug) }));
    },
  });
}

export function usePickerBlogPosts() {
  return useQuery({
    queryKey: ["picker-blog-posts"],
    queryFn: async () => {
      const res = await proxyFetch<Paginated<components["schemas"]["AdminBlogPostDto"]>>(
        "/admin/blog-posts?pageSize=100",
      );
      return (res.items ?? []).map((p) => ({ id: p.id, label: firstTranslationLabel(p.translations, p.slug) }));
    },
  });
}

// Hits the dedicated /admin/products/picker endpoint (id/slug/name only) —
// not the full admin products list, whose PRODUCT_INCLUDE pulls every
// variant's attribute values and every category/tag/attribute's
// translations for every row. That was fine for the real Products page but
// made this 100-row checkbox list genuinely slow to load once the catalog
// grew past a handful of products. No name/text search yet (confirmed in
// schema.d.ts — only category/brand/tag/price/sort filters on the full list
// endpoint), so this is still a plain "first 100" list, just a cheap one.
export function usePickerProducts() {
  return useQuery({
    queryKey: ["picker-products"],
    queryFn: async () => {
      const res = await proxyFetch<components["schemas"]["AdminProductPickerItemDto"][]>("/admin/products/picker");
      return res.map((p) => ({ id: p.id, label: p.name }));
    },
  });
}
