import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export interface PushSettings {
  configured: boolean;
  /** Safe to show — it is handed to every visitor anyway. The private key is
   *  never returned by the API. */
  publicKey: string | null;
  active: number;
  revoked: number;
  linkedToCustomer: number;
}

export interface GeneratedKeys {
  publicKey: string;
  privateKey: string;
}

const KEY = ["admin-push-settings"];

export function usePushSettings() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => proxyFetch<PushSettings>("/admin/push/settings"),
  });
}

/** Returns a fresh pair WITHOUT saving — rotating invalidates every existing
 *  subscription, so saving stays a second, deliberate click. */
export function useGeneratePushKeys() {
  return useMutation({
    mutationFn: () => proxyFetch<GeneratedKeys>("/admin/push/generate-keys", { method: "POST" }),
  });
}

export function useUpdatePushSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { publicKey?: string; privateKey?: string; subject?: string }) =>
      proxyFetch<PushSettings>("/admin/push/settings", {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
