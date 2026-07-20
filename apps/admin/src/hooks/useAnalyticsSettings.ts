import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export interface Ga4Config {
  enabled: boolean;
  measurementId: string;
  hasApiSecret: boolean;
}
export interface GtmConfig {
  enabled: boolean;
  containerId: string;
}
export interface MetaConfig {
  enabled: boolean;
  pixelId: string;
  testEventCode: string;
  hasAccessToken: boolean;
}
export interface GoogleAdsConfig {
  enabled: boolean;
  conversionId: string;
  conversionLabel: string;
}
export interface TiktokConfig {
  enabled: boolean;
  pixelCode: string;
  hasAccessToken: boolean;
}
export interface ClarityConfig {
  enabled: boolean;
  projectId: string;
}
export interface UtmConfig {
  enabled: boolean;
}

const KEY = ["analytics-settings"];
const BASE = "/admin/analytics/settings";

export function useGa4Settings() {
  return useQuery({ queryKey: [...KEY, "ga4"], queryFn: () => proxyFetch<Ga4Config>(`${BASE}/ga4`) });
}
export function useUpdateGa4Settings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { enabled?: boolean; measurementId?: string; apiSecret?: string }) =>
      proxyFetch<Ga4Config>(`${BASE}/ga4`, { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useGtmSettings() {
  return useQuery({ queryKey: [...KEY, "gtm"], queryFn: () => proxyFetch<GtmConfig>(`${BASE}/gtm`) });
}
export function useUpdateGtmSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<GtmConfig>) => proxyFetch<GtmConfig>(`${BASE}/gtm`, { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useMetaSettings() {
  return useQuery({ queryKey: [...KEY, "meta"], queryFn: () => proxyFetch<MetaConfig>(`${BASE}/meta`) });
}
export function useUpdateMetaSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { enabled?: boolean; pixelId?: string; testEventCode?: string; accessToken?: string }) =>
      proxyFetch<MetaConfig>(`${BASE}/meta`, { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useGoogleAdsSettings() {
  return useQuery({ queryKey: [...KEY, "google-ads"], queryFn: () => proxyFetch<GoogleAdsConfig>(`${BASE}/google-ads`) });
}
export function useUpdateGoogleAdsSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<GoogleAdsConfig>) =>
      proxyFetch<GoogleAdsConfig>(`${BASE}/google-ads`, { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useTiktokSettings() {
  return useQuery({ queryKey: [...KEY, "tiktok"], queryFn: () => proxyFetch<TiktokConfig>(`${BASE}/tiktok`) });
}
export function useUpdateTiktokSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { enabled?: boolean; pixelCode?: string; accessToken?: string }) =>
      proxyFetch<TiktokConfig>(`${BASE}/tiktok`, { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useClaritySettings() {
  return useQuery({ queryKey: [...KEY, "clarity"], queryFn: () => proxyFetch<ClarityConfig>(`${BASE}/clarity`) });
}
export function useUpdateClaritySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<ClarityConfig>) =>
      proxyFetch<ClarityConfig>(`${BASE}/clarity`, { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUtmSettings() {
  return useQuery({ queryKey: [...KEY, "utm"], queryFn: () => proxyFetch<UtmConfig>(`${BASE}/utm`) });
}
export function useUpdateUtmSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<UtmConfig>) => proxyFetch<UtmConfig>(`${BASE}/utm`, { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
