import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

export type Setting = components["schemas"]["SettingDto"];

const KEY = ["admin-settings"];

export function useSettings() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => proxyFetch<Setting[]>("/admin/settings"),
  });
}

export function useUpsertSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: Record<string, unknown> }) =>
      proxyFetch<Setting>(`/admin/settings/${key}`, { method: "PUT", body: JSON.stringify({ value }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
