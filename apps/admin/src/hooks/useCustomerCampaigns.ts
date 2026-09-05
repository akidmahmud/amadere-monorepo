import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { DelayUnit, CampaignStatus, QueueStatus } from "./useCartCampaigns";

/** Only two channels here, unlike the cart engine: a push subscription
 *  belongs to a browser, and a customer an admin just typed in has no
 *  browser attached to them. */
export type CustomerCampaignChannel = "EMAIL" | "SMS";

export interface CustomerCampaignTemplate {
  id: number;
  channel: CustomerCampaignChannel;
  name: string;
  subject: string | null;
  bodyEn: string;
  bodyBn: string;
  /** Rich HTML for email. The plain body still goes as the text alternative. */
  bodyHtmlEn: string | null;
  bodyHtmlBn: string | null;
  trigger: "CUSTOMER_ADDED" | "RECURRING";
  audience: "ALL" | "NO_ORDER_IN_DAYS";
  audienceDays: number | null;
  repeatEveryDays: number | null;
  delayValue: number;
  delayUnit: DelayUnit;
  status: CampaignStatus;
}

export interface CustomerCampaignQueueRow {
  id: number;
  customerId: number;
  templateId: number;
  channel: CustomerCampaignChannel;
  recipient: string | null;
  status: QueueStatus;
  attempts: number;
  scheduledAt: string;
  processedAt: string | null;
  lastError: string | null;
  template: { name: string; channel: CustomerCampaignChannel };
}

export interface CustomerCampaignSettings {
  enabled: boolean;
  maxAttempts: number;
  quietHoursStart: number;
  quietHoursEnd: number;
  recurringBatchSize: number;
}

const BASE = "/admin/net-profit/customer-campaigns";
const SETTINGS_KEY = ["customer-campaign-settings"];
const TEMPLATES_KEY = ["customer-campaign-templates"];
const QUEUE_KEY = ["customer-campaign-queue"];

export function useCustomerCampaignSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => proxyFetch<CustomerCampaignSettings>(`${BASE}/settings`),
  });
}

export function useUpdateCustomerCampaignSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CustomerCampaignSettings>) =>
      proxyFetch<CustomerCampaignSettings>(`${BASE}/settings`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}

export function useCustomerCampaignTemplates() {
  return useQuery({
    queryKey: TEMPLATES_KEY,
    queryFn: () => proxyFetch<CustomerCampaignTemplate[]>(`${BASE}/templates`),
  });
}

export function useUpsertCustomerCampaignTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<CustomerCampaignTemplate> & { id?: number }) =>
      proxyFetch<CustomerCampaignTemplate>(
        id ? `${BASE}/templates/${id}` : `${BASE}/templates`,
        { method: id ? "PATCH" : "POST", body: JSON.stringify(body) },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
}

export function useDeleteCustomerCampaignTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`${BASE}/templates/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
}

export function useCustomerCampaignQueue(status?: QueueStatus) {
  return useQuery({
    queryKey: [...QUEUE_KEY, status],
    queryFn: () =>
      proxyFetch<CustomerCampaignQueueRow[]>(
        `${BASE}/queue${status ? `?status=${status}` : ""}`,
      ),
  });
}

export function useCancelCustomerCampaignQueueItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`${BASE}/queue/${id}/cancel`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUEUE_KEY }),
  });
}

/** Sends one queued step immediately, ignoring its schedule — the only way
 *  to prove a template really delivers before switching the engine on. */
export function useSendCustomerCampaignNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`${BASE}/queue/${id}/send-now`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUEUE_KEY }),
  });
}
