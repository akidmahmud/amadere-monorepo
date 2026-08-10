import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

export type EmailBlockType = "heading" | "text" | "image" | "button" | "divider" | "spacer";
export interface EmailBlock {
  type: EmailBlockType;
  content: Record<string, unknown>;
}
export type EmailContentMode = "blocks" | "html";
export interface EmailContentJson {
  version: number;
  mode?: EmailContentMode;
  blocks: EmailBlock[];
  html?: string;
}
export type CampaignStatus = "DRAFT" | "SCHEDULED" | "SENDING" | "SENT" | "PARTIALLY_SENT" | "FAILED";

// Same swagger enum/bare-JSON erasure fix as every other module — contentJson
// and status on the response DTO come out as Record<string, never>.
export type AdminNewsletterCampaign = Omit<components["schemas"]["AdminNewsletterCampaignDto"], "contentJson" | "status"> & {
  contentJson: EmailContentJson;
  status: CampaignStatus;
};

export interface CampaignInput {
  name: string;
  subject: string;
  previewText?: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  blocks?: EmailBlock[];
  mode?: EmailContentMode;
  html?: string;
  segmentId?: number | null;
}

export interface PreviewContent {
  blocks?: EmailBlock[];
  mode?: EmailContentMode;
  html?: string;
}

export interface CampaignAnalytics {
  totalRecipients: number;
  totalSent: number;
  totalFailed: number;
  totalOpened: number;
  totalClicked: number;
  openRate: number | null;
  clickRate: number | null;
}

type Paginated<T> = { items?: T[]; total?: number };
const KEY = ["admin-newsletter-campaigns"];

export function useNewsletterCampaigns() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await proxyFetch<Paginated<AdminNewsletterCampaign>>("/admin/newsletter/campaigns?pageSize=100");
      return res.items ?? [];
    },
  });
}

export function useNewsletterCampaign(id: number | null) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => proxyFetch<AdminNewsletterCampaign>(`/admin/newsletter/campaigns/${id}`),
    enabled: id !== null,
  });
}

export function useCampaignAnalytics(id: number | null) {
  return useQuery({
    queryKey: [...KEY, id, "analytics"],
    queryFn: () => proxyFetch<CampaignAnalytics>(`/admin/newsletter/campaigns/${id}/analytics`),
    enabled: id !== null,
    refetchInterval: (query) => (query.state.data && query.state.data.totalSent + query.state.data.totalFailed < query.state.data.totalRecipients ? 5000 : false),
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CampaignInput) => proxyFetch<AdminNewsletterCampaign>("/admin/newsletter/campaigns", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateCampaign(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CampaignInput>) => proxyFetch<AdminNewsletterCampaign>(`/admin/newsletter/campaigns/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`/admin/newsletter/campaigns/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useSendTestCampaign(id: number) {
  return useMutation({
    mutationFn: (email: string) => proxyFetch<{ success: true }>(`/admin/newsletter/campaigns/${id}/test`, { method: "POST", body: JSON.stringify({ email }) }),
  });
}

export function useSendCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<AdminNewsletterCampaign>(`/admin/newsletter/campaigns/${id}/send`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useScheduleCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, scheduledAt }: { id: number; scheduledAt: string }) =>
      proxyFetch<AdminNewsletterCampaign>(`/admin/newsletter/campaigns/${id}/schedule`, { method: "POST", body: JSON.stringify({ scheduledAt }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCancelScheduleCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<AdminNewsletterCampaign>(`/admin/newsletter/campaigns/${id}/cancel-schedule`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

// Stateless render (no campaign id needed) — used for the live preview panel
// on both the campaign and template editors.
export function usePreviewContent() {
  return useMutation({
    mutationFn: (input: PreviewContent) =>
      proxyFetch<{ html: string; text: string }>("/admin/newsletter/campaigns/preview", { method: "POST", body: JSON.stringify(input) }),
  });
}
