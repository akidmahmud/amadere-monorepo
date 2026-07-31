import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export type SmtpEncryption = "none" | "tls" | "ssl";

export interface EmailConfig {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  encryption: SmtpEncryption;
  senderName: string;
  senderEmail: string;
  hasPassword: boolean;
}

export interface TestEmailResult {
  success: boolean;
  message: string;
}

const KEY = ["admin-email-settings"];
const BASE = "/admin/email-settings";

export function useEmailSettings() {
  return useQuery({ queryKey: KEY, queryFn: () => proxyFetch<EmailConfig>(BASE) });
}

export function useUpdateEmailSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<EmailConfig> & { password?: string }) =>
      proxyFetch<EmailConfig>(BASE, { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useSendTestEmail() {
  return useMutation({
    mutationFn: (to: string) => proxyFetch<TestEmailResult>(`${BASE}/test`, { method: "POST", body: JSON.stringify({ to }) }),
  });
}
