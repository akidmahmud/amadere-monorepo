import { useQuery } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

type NavMenu = components["schemas"]["PublicMenuItemDto"][];

// `initialData` is the server-fetched menu (see layout.tsx) — rendering the
// header/drawer's nav waits on nothing client-side; a background refetch
// (staleTime below) only updates it if it's actually gone stale.
//
// Routed through this app's own origin (`/api/backend/...`) rather than the
// public API host. Measured on production: that hostname is unreachable from
// a browser (ERR_CONNECTION_TIMED_OUT after ~21s) while the same-origin proxy
// answers in ~0.4s. Same-origin also cannot fail this way in principle — the
// request rides the hostname, certificate and CDN edge that already served
// the HTML.
export function useNavMenu(locale: "EN" | "BN", initialData?: NavMenu) {
  return useQuery({
    queryKey: ["nav-menu", locale],
    queryFn: () => proxyFetch<NavMenu>(`/menu?locale=${locale}`),
    initialData,
    staleTime: 5 * 60 * 1000,
  });
}
