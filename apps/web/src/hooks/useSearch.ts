import { useQuery } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";
import { getDeviceId } from "@/lib/device-id";

// Called directly from the browser (never proxied — see cart/useCart.ts for
// why that matters), so the backend's throttler would otherwise key off raw
// IP. That's a real problem for search-as-you-type specifically on
// Bangladeshi mobile carriers' CGNAT (PERF-BRIEF.md §7): many distinct real
// customers behind one carrier IP would share — and can exhaust — a single
// throttle bucket while just typing. The stable per-browser id already used
// for fraud-detection (device-id.ts) doubles as a correct-per-visitor
// throttle key here (see ClientThrottlerGuard on the backend).
function deviceHeaders(): Record<string, string> {
  const id = getDeviceId();
  return id ? { "X-Device-Id": id } : {};
}

// The endpoint returns an inline shape rather than a named DTO, so it is
// mirrored here instead of being referenced.
type SearchPage = {
  items?: components["schemas"]["ProductSearchHit"][];
  total?: number;
  page?: number;
  pageSize?: number;
};

function searchUrl(q: string, locale: string, page: number, pageSize: number) {
  const params = new URLSearchParams({
    q,
    locale,
    page: String(page),
    pageSize: String(pageSize),
  });
  return `/search/products?${params}`;
}

// Client-driven per AGENTS.web.md §7 ("search-as-you-type... → client via
// TanStack Query") — unlike catalog/PDP/blog, search results are never
// server-rendered.
//
// Routed through this app's own origin (`/api/backend/...`) rather than the
// public API host. Measured on production: the API hostname is unreachable
// from a browser (ERR_CONNECTION_TIMED_OUT after ~21s) while the same-origin
// proxy answers in ~0.4s, which is exactly why search returned nothing while
// server-rendered pages were fine. The proxy forwards X-Device-Id, so the
// per-visitor throttling described above still applies across the hop.
export function useSearchProducts(query: string, locale: string, page: number) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ["search", "products", trimmed, locale, page],
    queryFn: async () => {
      return proxyFetch<SearchPage>(searchUrl(trimmed, locale, page, 24), {
        headers: deviceHeaders(),
      });
    },
    enabled: trimmed.length >= 2,
  });
}

// Small, separate query (own key/cache entry) for the header's live-typing
// dropdown — same endpoint as useSearchProducts but a short pageSize, kept
// distinct rather than parameterizing that hook since the two have
// different callers/lifecycles (a page vs. a debounced dropdown).
export function useSearchSuggestions(query: string, locale: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ["search", "suggestions", trimmed, locale],
    queryFn: async () => {
      return proxyFetch<SearchPage>(searchUrl(trimmed, locale, 1, 5), {
        headers: deviceHeaders(),
      });
    },
    enabled: trimmed.length >= 2,
  });
}
