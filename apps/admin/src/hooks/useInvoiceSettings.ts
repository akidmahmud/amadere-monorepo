import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export type InvoiceDateFormat = "MDY" | "DMY" | "YMD";
export type InvoiceLanguageSupport = "default" | "arabic" | "bengali" | "chinese";

export interface InvoiceSettings {
  companyName: string;
  companyAddress: string;
  companyCity: string;
  companyState: string;
  companyCountry: string;
  companyZipcode: string;
  companyEmail: string;
  companyPhone: string;
  companyTaxId: string;
  companyLogoUrl: string | null;
  invoicePrefix: string;
  dateFormat: InvoiceDateFormat;
  disableUntilConfirmed: boolean;
  stampEnabled: boolean;
  stampImageUrl: string | null;
  customFontEnabled: boolean;
  customFontFamily: string;
  languageSupport: InvoiceLanguageSupport;
  termsAndConditions: string;
  // Invoice footer contact strip. Blank hides that tile.
  companyWebsite: string;
  companyFacebook: string;
  trustBadgeTitle: string;
  trustBadgeSubtitle: string;
}

const KEY = ["admin-invoice-settings"];
const BASE = "/admin/invoice-settings";

export function useInvoiceSettings() {
  return useQuery({ queryKey: KEY, queryFn: () => proxyFetch<InvoiceSettings>(BASE) });
}

export function useUpdateInvoiceSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<InvoiceSettings>) => proxyFetch<InvoiceSettings>(BASE, { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
