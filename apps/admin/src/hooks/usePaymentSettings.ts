import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

// Mirrors BkashConfig on the backend. The four secrets are never sent back —
// only has-it flags — so the form shows a placeholder and submits a value
// only when the admin actually types a new one.
export type BkashConfig = {
  isActive: boolean;
  liveMode: boolean;
  methodNameEn: string;
  methodNameBn: string;
  descriptionEn: string;
  descriptionBn: string;
  logoUrl: string;
  hasUsername: boolean;
  hasPassword: boolean;
  hasAppKey: boolean;
  hasAppSecretKey: boolean;
  isConfigured: boolean;
};

export type BkashUpdate = Partial<
  Omit<BkashConfig, "hasUsername" | "hasPassword" | "hasAppKey" | "hasAppSecretKey" | "isConfigured">
> & {
  username?: string;
  password?: string;
  appKey?: string;
  appSecretKey?: string;
};

const KEY = ["admin-payment-settings", "bkash"];

export function useBkashSettings() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => proxyFetch<BkashConfig>("/admin/payment-settings/bkash"),
  });
}

export type BkashTestResult = {
  ok: boolean;
  environment: "live" | "sandbox";
  message: string;
};

// Asks bKash to authenticate the stored credentials and reports its own
// answer back, so a bad key set is caught here instead of by a customer.
export function useTestBkashCredentials() {
  return useMutation({
    mutationFn: () =>
      proxyFetch<BkashTestResult>("/admin/payment-settings/bkash/test", { method: "POST" }),
  });
}

export function useUpdateBkashSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: BkashUpdate) =>
      proxyFetch<BkashConfig>("/admin/payment-settings/bkash", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
