export const SORT_OPTIONS = [
  { value: "BEST_SELLING", label: "Best Selling" },
  { value: "PRICE_ASC", label: "Price: Low to High" },
  { value: "PRICE_DESC", label: "Price: High to Low" },
  { value: "NEWEST", label: "Newest" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export interface PlpSearchParams {
  categoryId?: string;
  tagId?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  page?: string;
}

export interface PlpFilters {
  categoryId?: number;
  tagId?: number;
  minPrice?: number;
  maxPrice?: number;
  sort: SortValue;
  page: number;
}

const VALID_SORTS = new Set(SORT_OPTIONS.map((o) => o.value));

export function parsePlpSearchParams(params: PlpSearchParams): PlpFilters {
  const sort = params.sort && VALID_SORTS.has(params.sort as SortValue) ? (params.sort as SortValue) : "NEWEST";
  const page = Math.max(1, Number(params.page) || 1);
  return {
    categoryId: params.categoryId ? Number(params.categoryId) : undefined,
    tagId: params.tagId ? Number(params.tagId) : undefined,
    minPrice: params.minPrice ? Number(params.minPrice) : undefined,
    maxPrice: params.maxPrice ? Number(params.maxPrice) : undefined,
    sort,
    page,
  };
}

// Builds a query string for a filter-state change, dropping any key whose
// value is undefined/default so "clean" URLs (no filters, page 1, default
// sort) stay query-string-free.
export function buildPlpHref(base: string, filters: Partial<PlpFilters>): string {
  const search = new URLSearchParams();
  if (filters.categoryId !== undefined) search.set("categoryId", String(filters.categoryId));
  if (filters.tagId !== undefined) search.set("tagId", String(filters.tagId));
  if (filters.minPrice !== undefined) search.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice !== undefined) search.set("maxPrice", String(filters.maxPrice));
  if (filters.sort && filters.sort !== "NEWEST") search.set("sort", filters.sort);
  if (filters.page && filters.page > 1) search.set("page", String(filters.page));
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}

// True when any non-default filter/sort/page is applied — used to decide
// robots (noindex on filtered/paginated variants, per AGENTS.web.md §8).
export function isFilteredView(filters: PlpFilters): boolean {
  return (
    filters.categoryId !== undefined ||
    filters.tagId !== undefined ||
    filters.minPrice !== undefined ||
    filters.maxPrice !== undefined ||
    filters.sort !== "NEWEST" ||
    filters.page !== 1
  );
}
