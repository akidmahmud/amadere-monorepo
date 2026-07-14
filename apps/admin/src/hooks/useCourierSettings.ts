import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export interface SteadfastConfig {
  enabled: boolean;
  hasApiKey: boolean;
  hasSecretKey: boolean;
}

export interface PathaoConfig {
  enabled: boolean;
  environment: "live" | "sandbox";
  autoStatusSync: boolean;
  clientId: string;
  username: string;
  storeId: number | null;
  hasClientSecret: boolean;
  hasPassword: boolean;
}

export interface RedxConfig {
  enabled: boolean;
  environment: "live" | "sandbox";
  autoStatusSync: boolean;
  pickupStoreId: number | null;
  hasApiToken: boolean;
}

const KEY = ["courier-settings"];

export function useSteadfastSettings() {
  return useQuery({ queryKey: [...KEY, "steadfast"], queryFn: () => proxyFetch<SteadfastConfig>("/admin/courier/settings/steadfast") });
}
export function useUpdateSteadfastSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { enabled?: boolean; apiKey?: string; secretKey?: string }) =>
      proxyFetch<SteadfastConfig>("/admin/courier/settings/steadfast", { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function usePathaoSettings() {
  return useQuery({ queryKey: [...KEY, "pathao"], queryFn: () => proxyFetch<PathaoConfig>("/admin/courier/settings/pathao") });
}
export function useUpdatePathaoSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<PathaoConfig> & { clientSecret?: string; password?: string }) =>
      proxyFetch<PathaoConfig>("/admin/courier/settings/pathao", { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
export function useTestPathaoConnection() {
  return useMutation({ mutationFn: () => proxyFetch<{ success: boolean; message: string }>("/admin/courier/settings/pathao/test", { method: "POST" }) });
}

export function useRedxSettings() {
  return useQuery({ queryKey: [...KEY, "redx"], queryFn: () => proxyFetch<RedxConfig>("/admin/courier/settings/redx") });
}
export function useUpdateRedxSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<RedxConfig> & { apiToken?: string }) =>
      proxyFetch<RedxConfig>("/admin/courier/settings/redx", { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
export function useTestRedxConnection() {
  return useMutation({ mutationFn: () => proxyFetch<{ success: boolean; message: string }>("/admin/courier/settings/redx/test", { method: "POST" }) });
}

export function usePathaoStores() {
  return useQuery({ queryKey: ["pathao-stores"], queryFn: () => proxyFetch<{ store_id: number; store_name: string }[]>("/admin/courier/pathao/stores"), staleTime: 60 * 60 * 1000 });
}
export function usePathaoCities() {
  return useQuery({ queryKey: ["pathao-cities"], queryFn: () => proxyFetch<{ city_id: number; city_name: string }[]>("/admin/courier/pathao/cities"), staleTime: 60 * 60 * 1000 });
}
export function usePathaoZones(cityId: number | undefined) {
  return useQuery({
    queryKey: ["pathao-zones", cityId],
    queryFn: () => proxyFetch<{ zone_id: number; zone_name: string }[]>(`/admin/courier/pathao/zones/${cityId}`),
    enabled: !!cityId,
    staleTime: 60 * 60 * 1000,
  });
}
export function usePathaoAreas(zoneId: number | undefined) {
  return useQuery({
    queryKey: ["pathao-areas", zoneId],
    queryFn: () => proxyFetch<{ area_id: number; area_name: string }[]>(`/admin/courier/pathao/areas/${zoneId}`),
    enabled: !!zoneId,
    staleTime: 60 * 60 * 1000,
  });
}
export function useRedxAreas() {
  return useQuery({ queryKey: ["redx-areas"], queryFn: () => proxyFetch<{ id: number; name: string }[]>("/admin/courier/redx/areas"), staleTime: 60 * 60 * 1000 });
}
export function useRedxPickupStores() {
  return useQuery({ queryKey: ["redx-pickup-stores"], queryFn: () => proxyFetch<{ id: number; name: string }[]>("/admin/courier/redx/pickup-stores"), staleTime: 60 * 60 * 1000 });
}
