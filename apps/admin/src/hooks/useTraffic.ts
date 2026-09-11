import { useQuery } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export interface TrafficStats {
  /** Distinct sessions active in the last `liveWindowMinutes`. */
  liveVisitors: number;
  viewsToday: number;
  visitorsToday: number;
  visitorsYesterday: number;
  topPages: { path: string; views: number }[];
  topSources: { source: string; views: number }[];
  devices: { device: string; views: number }[];
  liveWindowMinutes: number;
}

/**
 * Live site traffic, from our own page-view table.
 *
 * Polls, because "who is on the site right now" is worthless the moment it
 * goes stale. 30s is well inside the 5-minute live window, so the number never
 * lags reality by more than a rounding error.
 */
export function useTraffic() {
  return useQuery({
    queryKey: ["admin-traffic-stats"],
    queryFn: () => proxyFetch<TrafficStats>("/admin/traffic/stats"),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}
