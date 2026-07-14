import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export interface SmsTemplate {
  id: number;
  key: string;
  bodyEn: string;
  bodyBn: string;
  enabled: boolean;
}

export interface SmsLog {
  id: number;
  to: string;
  body: string;
  templateKey: string | null;
  status: "QUEUED" | "SENT" | "FAILED";
  provider: string;
  cost: string | null;
  code: number | null;
  codeMessage: string | null;
  createdAt: string;
}

// Every {{token}} referenced by that template's real send call site
// (SmsEventListener / checkout.service.ts / recovery.service.ts) — shown
// as a legend next to the editor so an admin doesn't have to guess.
export const TEMPLATE_PLACEHOLDERS: Record<string, string[]> = {
  otp: ["code"],
  order_placed: ["orderNumber", "amount"],
  order_confirmed: ["orderNumber"],
  order_shipped: ["orderNumber", "courier", "trackingUrl"],
  order_delivered: ["orderNumber"],
  recovery: ["resumeUrl"],
  advance_request: ["orderNumber", "amount", "payUrl"],
};

interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

const TEMPLATES_KEY = ["net-profit-sms-templates"];
const LOGS_KEY = ["net-profit-sms-logs"];
const SETTINGS_KEY = ["net-profit-sms-settings"];

export function useSmsTemplates() {
  return useQuery({ queryKey: TEMPLATES_KEY, queryFn: () => proxyFetch<SmsTemplate[]>("/admin/net-profit/sms/templates") });
}

export function useUpdateSmsTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, ...input }: { key: string; bodyEn?: string; bodyBn?: string; enabled?: boolean }) =>
      proxyFetch<SmsTemplate>(`/admin/net-profit/sms/templates/${key}`, { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
}

export function useSmsLogs() {
  return useQuery({ queryKey: LOGS_KEY, queryFn: () => proxyFetch<Paginated<SmsLog>>("/admin/net-profit/sms/logs") });
}

export function useTestSendSms() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { to: string; body: string }) =>
      proxyFetch<SmsLog>("/admin/net-profit/sms/test", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOGS_KEY }),
  });
}

export interface SmsSettings {
  enabled: boolean;
  senderId: string;
  senderIdMasked: boolean;
  statusTriggers: { CONFIRMED: boolean; PROCESSING: boolean; COMPLETED: boolean };
  hasApiKey: boolean;
}

export function useSmsSettings() {
  return useQuery({ queryKey: SETTINGS_KEY, queryFn: () => proxyFetch<SmsSettings>("/admin/net-profit/sms/settings") });
}

export function useUpdateSmsSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<SmsSettings> & { apiKey?: string }) =>
      proxyFetch<SmsSettings>("/admin/net-profit/sms/settings", { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}

export function useClearSmsApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => proxyFetch<SmsSettings>("/admin/net-profit/sms/settings/api-key", { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}

// Manual trigger (a "Check Balance" button), not an auto-load-on-mount
// query — a live gateway call shouldn't fire just from opening the tab.
export function useSmsBalance() {
  return useQuery({
    queryKey: ["net-profit-sms-balance"],
    queryFn: () => proxyFetch<{ balance: number | null }>("/admin/net-profit/sms/balance"),
    enabled: false,
  });
}

export function useBulkSendSms() {
  return useMutation({
    mutationFn: (input: { body: string; segment: "all" | "has_ordered" }) =>
      proxyFetch<{ queued: number }>("/admin/net-profit/sms/bulk", { method: "POST", body: JSON.stringify(input) }),
  });
}
