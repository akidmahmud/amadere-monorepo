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
    // `value` is genuinely arbitrary JSON backend-side (UpsertSettingDto's
    // `value: unknown`) — most existing settings happen to be objects, but
    // e.g. site_logo_media_id is a plain number, so this can't be narrowed
    // to Record<string, unknown> the way it previously was.
    mutationFn: ({ key, value }: { key: string; value: unknown }) =>
      proxyFetch<Setting>(`/admin/settings/${key}`, { method: "PUT", body: JSON.stringify({ value }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

// Public, unauthenticated site-info (name/logo/card style) — reused here
// instead of a separate admin-only endpoint since it already resolves the
// logo's real URL from its media row, exactly what a logo preview needs,
// and the generic admin proxy forwards to it fine even though it doesn't
// require the auth token it happens to attach.
export function useSiteInfo() {
  return useQuery({
    queryKey: ["site-info"],
    queryFn: () => proxyFetch<components["schemas"]["SiteInfoDto"]>("/settings/site"),
  });
}
