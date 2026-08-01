import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export interface InvoiceTemplateSettings {
  enabled: boolean;
  template: string;
  defaultTemplate: string;
}

const KEY = ["admin-invoice-template-settings"];
const BASE = "/admin/invoice-template-settings";

export function useInvoiceTemplateSettings() {
  return useQuery({ queryKey: KEY, queryFn: () => proxyFetch<InvoiceTemplateSettings>(BASE) });
}

export function useUpdateInvoiceTemplateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { enabled?: boolean; template?: string }) =>
      proxyFetch<InvoiceTemplateSettings>(BASE, { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
