import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export interface SitemapSettings {
  enabled: boolean;
  indexNowEnabled: boolean;
  indexNowKey: string | null;
  urlCount: number;
  sitemapUrl: string;
  robotsUrl: string;
  indexNowFileUrl: string | null;
}

export interface PingResult {
  success: boolean;
  message: string;
}

const KEY = ["admin-sitemap"];
const BASE = "/admin/sitemap";

export function useSitemapSettings() {
  return useQuery({ queryKey: KEY, queryFn: () => proxyFetch<SitemapSettings>(BASE) });
}

export function useUpdateSitemapSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { enabled?: boolean; indexNowEnabled?: boolean }) =>
      proxyFetch<SitemapSettings>(BASE, { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useGenerateIndexNowKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => proxyFetch<SitemapSettings>(`${BASE}/indexnow/generate-key`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function usePingIndexNow() {
  return useMutation({
    mutationFn: () => proxyFetch<PingResult>(`${BASE}/indexnow/ping`, { method: "POST" }),
  });
}
