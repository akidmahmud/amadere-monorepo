import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

// Mirrors WhatsappSettings in the backend's whatsapp-settings.service.ts.
// Hand-written rather than generated: the endpoint returns the raw settings
// interface, not a decorated response DTO, so it has no schema.d.ts entry.
export interface WhatsappSettings {
  enabled: boolean;
  phoneNumber: string;
  productMessageTemplate: string;
  floatingMessageTemplate: string;
  callEnabled: boolean;
  callNumber: string;
}

const KEY = ["whatsapp-settings"];

export function useWhatsappSettings() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => proxyFetch<WhatsappSettings>("/admin/whatsapp/settings"),
  });
}

export function useUpdateWhatsappSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<WhatsappSettings>) =>
      proxyFetch<WhatsappSettings>("/admin/whatsapp/settings", { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
