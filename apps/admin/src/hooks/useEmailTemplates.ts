import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

export type EmailTemplate = components["schemas"]["EmailTemplateDto"];
export type EmailTemplateSettings = components["schemas"]["EmailTemplateSettingsDto"];
export type EmailTemplatePreview = components["schemas"]["EmailTemplatePreviewDto"];

const KEY = ["email-templates"];
const SETTINGS_KEY = ["email-template-settings"];
const BASE = "/admin/email-templates";

export function useEmailTemplates() {
  return useQuery({ queryKey: KEY, queryFn: () => proxyFetch<EmailTemplate[]>(BASE) });
}

export function useEmailTemplate(key: string) {
  return useQuery({
    queryKey: [...KEY, key],
    queryFn: () => proxyFetch<EmailTemplate>(`${BASE}/${key}`),
    enabled: !!key,
  });
}

export function useUpdateEmailTemplate(key: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { subject?: string; bodyHtml?: string; enabled?: boolean }) =>
      proxyFetch<EmailTemplate>(`${BASE}/${key}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useResetEmailTemplate(key: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => proxyFetch<EmailTemplate>(`${BASE}/${key}/reset`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function usePreviewEmailTemplate(key: string) {
  return useMutation({
    mutationFn: (draft: { subject?: string; bodyHtml?: string }) =>
      proxyFetch<EmailTemplatePreview>(`${BASE}/${key}/preview`, { method: "POST", body: JSON.stringify(draft) }),
  });
}

export function useEmailTemplateSettings() {
  return useQuery({ queryKey: SETTINGS_KEY, queryFn: () => proxyFetch<EmailTemplateSettings>(`${BASE}/settings`) });
}

export function useUpdateEmailTemplateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      logoMediaId?: number | null;
      contactEmail?: string;
      copyright?: string;
      logoHeight?: number;
      customCss?: string;
    }) => proxyFetch<EmailTemplateSettings>(`${BASE}/settings`, { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}
