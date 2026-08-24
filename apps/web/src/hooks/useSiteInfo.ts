import { useQuery } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

type SiteInfo = components["schemas"]["SiteInfoDto"];

// Same-origin (`/api/backend/...`), not the public API host directly.
//
// SiteHeader calls this on every page, so when the API hostname is
// unreachable from a browser this one request stalls the whole page: measured
// on production as two ERR_CONNECTION_TIMED_OUT after 21.9s and 44.3s, with
// no first paint inside 30s. Going through this app's own origin removes that
// entire class of failure — the request rides the same hostname, TLS
// certificate and CDN edge that already served the HTML, so it cannot be
// reachable for the page but not for the data.
export function useSiteInfo() {
  return useQuery({
    queryKey: ["site-info"],
    queryFn: () => proxyFetch<SiteInfo>("/settings/site"),
    staleTime: Infinity,
  });
}
