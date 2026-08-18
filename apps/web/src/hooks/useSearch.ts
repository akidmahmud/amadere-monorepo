import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
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

// Client-driven per AGENTS.web.md §7 ("search-as-you-type... → client via
// TanStack Query") — unlike catalog/PDP/blog, search results are never
// server-rendered.
export function useSearchProducts(query: string, locale: string, page: number) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ["search", "products", trimmed, locale, page],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/search/products", {
        params: { query: { q: trimmed, locale: locale as "EN" | "BN", page, pageSize: 24 } },
        headers: deviceHeaders(),
      });
      if (error) throw error;
      return data;
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
      const { data, error } = await api.GET("/api/v1/search/products", {
        params: { query: { q: trimmed, locale: locale as "EN" | "BN", page: 1, pageSize: 5 } },
        headers: deviceHeaders(),
      });
      if (error) throw error;
      return data;
    },
    enabled: trimmed.length >= 2,
  });
}
