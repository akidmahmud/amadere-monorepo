import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

export type CatalogFeedStatus = components["schemas"]["CatalogFeedStatusDto"];

const KEY = ["catalog-feed-status"];

export function useCatalogFeedStatus() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => proxyFetch<CatalogFeedStatus>("/admin/catalog-feed/status"),
  });
}

export function useRefreshCatalogFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      proxyFetch<CatalogFeedStatus>("/admin/catalog-feed/refresh", { method: "POST" }),
    // Writes the fresh status straight into the cache rather than
    // invalidating: the refresh response IS the new status, so refetching
    // would run the whole build a second time.
    onSuccess: (data) => qc.setQueryData(KEY, data),
  });
}
