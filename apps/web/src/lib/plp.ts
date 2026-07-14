export const SORT_OPTIONS = [
  { value: "BEST_SELLING", label: "Best Selling" },
  { value: "PRICE_ASC", label: "Price: Low to High" },
  { value: "PRICE_DESC", label: "Price: High to Low" },
  { value: "NEWEST", label: "Newest" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export interface PlpSearchParams {
  categoryId?: string | string[];
  tagId?: string | string[];
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  page?: string;
}

export interface PlpFilters {
  categoryIds: number[];
  tagIds: number[];
  minPrice?: number;
  maxPrice?: number;
  sort: SortValue;
  page: number;
}

const VALID_SORTS = new Set(SORT_OPTIONS.map((o) => o.value));

function parseIds(value: string | string[] | undefined): number[] {
  if (value === undefined) return [];
  const raw = Array.isArray(value) ? value : [value];
  return raw.map(Number).filter((n) => Number.isFinite(n));
}

export function parsePlpSearchParams(params: PlpSearchParams): PlpFilters {
  const sort = params.sort && VALID_SORTS.has(params.sort as SortValue) ? (params.sort as SortValue) : "NEWEST";
  const page = Math.max(1, Number(params.page) || 1);
  return {
    categoryIds: parseIds(params.categoryId),
    tagIds: parseIds(params.tagId),
    minPrice: params.minPrice ? Number(params.minPrice) : undefined,
    maxPrice: params.maxPrice ? Number(params.maxPrice) : undefined,
    sort,
    page,
  };
}

// Builds a query string for a filter-state change, dropping any key whose
// value is undefined/default so "clean" URLs (no filters, page 1, default
// sort) stay query-string-free. Multiple selected ids repeat the same key
// (?categoryId=1&categoryId=2), matching how the backend/URLSearchParams
// both already expect repeated-key arrays.
export function buildPlpHref(base: string, filters: Partial<PlpFilters>): string {
  const search = new URLSearchParams();
  for (const id of filters.categoryIds ?? []) search.append("categoryId", String(id));
  for (const id of filters.tagIds ?? []) search.append("tagId", String(id));
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
    filters.categoryIds.length > 0 ||
    filters.tagIds.length > 0 ||
    filters.minPrice !== undefined ||
    filters.maxPrice !== undefined ||
    filters.sort !== "NEWEST" ||
    filters.page !== 1
  );
}
