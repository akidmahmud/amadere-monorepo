export const SORT_OPTIONS = [
  { value: "BEST_SELLING", label: "Best Selling" },
  { value: "PRICE_ASC", label: "Price: Low to High" },
  { value: "PRICE_DESC", label: "Price: High to Low" },
  { value: "NEWEST", label: "Newest" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

// Pixel-matched to ghorerbazar.com's "Show" per-page select
// (offer-zone collection page) — "Default" (undefined) falls back to
// whatever page size the calling route already uses.
export const PAGE_SIZE_OPTIONS = [16, 20, 24, 36] as const;

export const FLAG_LABEL_OPTIONS = [
  { value: "BEST_SELLING", label: "Best Selling" },
  { value: "NEW_ARRIVAL", label: "New Arrival" },
] as const;

export type FlagLabelValue = (typeof FLAG_LABEL_OPTIONS)[number]["value"];
const VALID_FLAG_LABELS = new Set(FLAG_LABEL_OPTIONS.map((o) => o.value));

export interface PlpSearchParams {
  categoryId?: string | string[];
  brandId?: string;
  collectionId?: string | string[];
  flagLabel?: string | string[];
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  page?: string;
  pageSize?: string;
}

export interface PlpFilters {
  categoryIds: number[];
  brandId?: number;
  collectionIds: number[];
  flagLabels: FlagLabelValue[];
  minPrice?: number;
  maxPrice?: number;
  sort: SortValue;
  page: number;
  /** Undefined = the route's own default page size. */
  pageSize?: number;
}

const VALID_SORTS = new Set(SORT_OPTIONS.map((o) => o.value));
const VALID_PAGE_SIZES = new Set<number>(PAGE_SIZE_OPTIONS);

function parseIds(value: string | string[] | undefined): number[] {
  if (value === undefined) return [];
  const raw = Array.isArray(value) ? value : [value];
  return raw.map(Number).filter((n) => Number.isFinite(n));
}

function parseFlagLabels(value: string | string[] | undefined): FlagLabelValue[] {
  if (value === undefined) return [];
  const raw = Array.isArray(value) ? value : [value];
  return raw.filter((v): v is FlagLabelValue => VALID_FLAG_LABELS.has(v as FlagLabelValue));
}

export function parsePlpSearchParams(params: PlpSearchParams): PlpFilters {
  const sort = params.sort && VALID_SORTS.has(params.sort as SortValue) ? (params.sort as SortValue) : "NEWEST";
  const page = Math.max(1, Number(params.page) || 1);
  const parsedPageSize = params.pageSize ? Number(params.pageSize) : undefined;
  const pageSize = parsedPageSize && VALID_PAGE_SIZES.has(parsedPageSize) ? parsedPageSize : undefined;
  return {
    categoryIds: parseIds(params.categoryId),
    brandId: params.brandId ? Number(params.brandId) : undefined,
    collectionIds: parseIds(params.collectionId),
    flagLabels: parseFlagLabels(params.flagLabel),
    minPrice: params.minPrice ? Number(params.minPrice) : undefined,
    maxPrice: params.maxPrice ? Number(params.maxPrice) : undefined,
    sort,
    page,
    pageSize,
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
  if (filters.brandId !== undefined) search.set("brandId", String(filters.brandId));
  for (const id of filters.collectionIds ?? []) search.append("collectionId", String(id));
  for (const flag of filters.flagLabels ?? []) search.append("flagLabel", flag);
  if (filters.minPrice !== undefined) search.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice !== undefined) search.set("maxPrice", String(filters.maxPrice));
  if (filters.sort && filters.sort !== "NEWEST") search.set("sort", filters.sort);
  if (filters.pageSize) search.set("pageSize", String(filters.pageSize));
  if (filters.page && filters.page > 1) search.set("page", String(filters.page));
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}

// True when any non-default filter/sort/page is applied — used to decide
// robots (noindex on filtered/paginated variants, per AGENTS.web.md §8).
export function isFilteredView(filters: PlpFilters): boolean {
  return (
    filters.categoryIds.length > 0 ||
    filters.brandId !== undefined ||
    filters.collectionIds.length > 0 ||
    filters.flagLabels.length > 0 ||
    filters.minPrice !== undefined ||
    filters.maxPrice !== undefined ||
    filters.sort !== "NEWEST" ||
    filters.pageSize !== undefined ||
    filters.page !== 1
  );
}
