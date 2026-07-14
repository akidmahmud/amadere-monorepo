import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export type CampaignChannel = "EMAIL" | "SMS";
export type DelayUnit = "MINUTE" | "HOUR" | "DAY";
export type CampaignStatus = "ACTIVE" | "PAUSED";
export type QueueStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED";

export interface CartCampaignTemplate {
  id: number;
  channel: CampaignChannel;
  name: string;
  subject: string | null;
  bodyEn: string;
  bodyBn: string;
  delayValue: number;
  delayUnit: DelayUnit;
  status: CampaignStatus;
}

export interface CartCampaignQueueItem {
  id: number;
  incompleteId: number;
  templateId: number;
  channel: CampaignChannel;
  recipient: string | null;
  status: QueueStatus;
  attempts: number;
  scheduledAt: string;
  processedAt: string | null;
  lastError: string | null;
}

export interface CartCampaignLog {
  id: number;
  incompleteId: number;
  channel: CampaignChannel;
  recipient: string | null;
  message: string;
  status: string;
  sentAt: string;
}

export interface CartCampaignSettings {
  enabled: boolean;
  maxAttempts: number;
  quietHoursStart: number;
  quietHoursEnd: number;
}

// The 13 merge tags MergeTagsService understands, for the template editor's
// legend — same list used by both cart campaigns and the manual recovery
// SMS template.
export const MERGE_TAGS: { token: string; label: string }[] = [
  { token: "customerName", label: "Full customer name" },
  { token: "firstName", label: "Customer first name" },
  { token: "customerEmail", label: "Customer email" },
  { token: "customerPhone", label: "Customer phone" },
  { token: "amount", label: "Cart total as number only" },
  { token: "amountWithCurrency", label: "Cart total with ৳ symbol" },
  { token: "productNames", label: "Comma-separated product names" },
  { token: "productLinks", label: "Email-ready linked product list" },
  { token: "productUrls", label: "Comma-separated product URLs" },
  { token: "cartLink", label: "Cart page URL" },
  { token: "checkoutLink", label: "Checkout page URL" },
  { token: "siteName", label: "Website name" },
  { token: "siteUrl", label: "Website URL" },
];

const TEMPLATES_KEY = ["net-profit-cart-campaign-templates"];
const QUEUE_KEY = ["net-profit-cart-campaign-queue"];
const LOGS_KEY = ["net-profit-cart-campaign-logs"];
const SETTINGS_KEY = ["net-profit-cart-campaign-settings"];

export function useCampaignTemplates() {
  return useQuery({ queryKey: TEMPLATES_KEY, queryFn: () => proxyFetch<CartCampaignTemplate[]>("/admin/net-profit/cart-campaigns/templates") });
}

export function useCreateCampaignTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CartCampaignTemplate, "id" | "status"> & { status?: CampaignStatus }) =>
      proxyFetch<CartCampaignTemplate>("/admin/net-profit/cart-campaigns/templates", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
}

export function useUpdateCampaignTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: number } & Partial<CartCampaignTemplate>) =>
      proxyFetch<CartCampaignTemplate>(`/admin/net-profit/cart-campaigns/templates/${id}`, { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
}

export function useDeleteCampaignTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`/admin/net-profit/cart-campaigns/templates/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
}

export function useCampaignQueue(status?: QueueStatus) {
  return useQuery({
    queryKey: [...QUEUE_KEY, status ?? "all"],
    queryFn: () => proxyFetch<CartCampaignQueueItem[]>(`/admin/net-profit/cart-campaigns/queue${status ? `?status=${status}` : ""}`),
  });
}

export function useRetryCampaignQueueItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch(`/admin/net-profit/cart-campaigns/queue/${id}/retry`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUEUE_KEY });
      qc.invalidateQueries({ queryKey: LOGS_KEY });
    },
  });
}

export function useCancelCampaignQueueItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch(`/admin/net-profit/cart-campaigns/queue/${id}/cancel`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUEUE_KEY }),
  });
}

export function useCampaignLogs() {
  return useQuery({ queryKey: LOGS_KEY, queryFn: () => proxyFetch<CartCampaignLog[]>("/admin/net-profit/cart-campaigns/logs") });
}

export function useCampaignSettings() {
  return useQuery({ queryKey: SETTINGS_KEY, queryFn: () => proxyFetch<CartCampaignSettings>("/admin/net-profit/cart-campaigns/settings") });
}

export function useUpdateCampaignSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CartCampaignSettings>) =>
      proxyFetch<CartCampaignSettings>("/admin/net-profit/cart-campaigns/settings", { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}
