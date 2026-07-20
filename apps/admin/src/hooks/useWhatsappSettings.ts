import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export interface WhatsappSettings {
  enabled: boolean;
  phoneNumber: string;
  productMessageTemplate: string;
  floatingMessageTemplate: string;
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
