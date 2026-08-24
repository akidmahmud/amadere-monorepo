import { useQuery } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

type Announcements = components["schemas"]["PublicAnnouncementDto"][];

// `initialData` is the server-fetched list (see layout.tsx) — the bar
// renders in the first paint instead of appearing after a client fetch.
//
// Routed through this app's own origin (`/api/backend/...`) rather than the
// public API host. Measured on production: that hostname is unreachable from
// a browser (ERR_CONNECTION_TIMED_OUT after ~21s) while the same-origin proxy
// answers in ~0.4s. Same-origin also cannot fail this way in principle — the
// request rides the hostname, certificate and CDN edge that already served
// the HTML.
export function useAnnouncements(locale: "EN" | "BN", initialData?: Announcements) {
  return useQuery({
    queryKey: ["announcements", locale],
    queryFn: () => proxyFetch<Announcements>(`/announcements?locale=${locale}`),
    initialData,
    staleTime: 5 * 60 * 1000,
  });
}
