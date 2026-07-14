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
  createdAt: string;
}

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
}

export function useSmsSettings() {
  return useQuery({ queryKey: SETTINGS_KEY, queryFn: () => proxyFetch<SmsSettings>("/admin/net-profit/sms/settings") });
}

export function useUpdateSmsSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<SmsSettings>) =>
      proxyFetch<SmsSettings>("/admin/net-profit/sms/settings", { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}

export function useSmsBalance() {
  return useQuery({
    queryKey: ["net-profit-sms-balance"],
    queryFn: () => proxyFetch<{ balance: number | null }>("/admin/net-profit/sms/balance"),
  });
}

export function useBulkSendSms() {
  return useMutation({
    mutationFn: (input: { body: string; segment: "all" | "has_ordered" }) =>
      proxyFetch<{ queued: number }>("/admin/net-profit/sms/bulk", { method: "POST", body: JSON.stringify(input) }),
  });
}
