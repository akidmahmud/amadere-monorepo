import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export type VpnPolicy = "allow" | "challenge" | "block";

export interface OtpSecuritySettings {
  vpnPolicy: VpnPolicy;
  codOtpEnabled: boolean;
  codOtpLength: number;
  codOtpExpiryMinutes: number;
}

const KEY = ["net-profit-otp-security-settings"];

export function useOtpSecuritySettings() {
  return useQuery({ queryKey: KEY, queryFn: () => proxyFetch<OtpSecuritySettings>("/admin/net-profit/otp-security/settings") });
}

export function useUpdateOtpSecuritySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<OtpSecuritySettings>) =>
      proxyFetch<OtpSecuritySettings>("/admin/net-profit/otp-security/settings", { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: (data) => qc.setQueryData(KEY, data),
  });
}
