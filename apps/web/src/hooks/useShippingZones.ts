import { useQuery } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

export type PublicShippingZone = components["schemas"]["PublicShippingZoneDto"];

// Public and unauthenticated — the proxy simply forwards it without a token.
//
// Routed through this app's own origin (`/api/backend/...`) rather than the
// public API host. Measured on production: that hostname is unreachable from
// a browser (ERR_CONNECTION_TIMED_OUT after ~21s) while the same-origin proxy
// answers in ~0.4s. Same-origin also cannot fail this way in principle — the
// request rides the hostname, certificate and CDN edge that already served
// the HTML.
export function useShippingZones(locale: string) {
  return useQuery({
    queryKey: ["shipping-zones", locale],
    queryFn: () =>
      proxyFetch<PublicShippingZone[]>(`/shipping-zones?locale=${locale}`),
    // Rates change when an admin edits them, which is rare — but they must
    // not be stale enough to contradict the fee in the order total.
    staleTime: 5 * 60 * 1000,
  });
}
