import { useMutation, useQuery } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

type PaymentMethodConfigDto = components["schemas"]["PaymentMethodConfigDto"];

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

// Public — merchant number/instructions/icon for each active manual method,
// what checkout renders once the customer picks bKash/Nagad/Rocket/Upay.
export function usePaymentMethodConfigs() {
  return useQuery({
    queryKey: ["payment-method-configs"],
    queryFn: async () => {
      return proxyFetch<PaymentMethodConfigDto[]>("/net-profit/payment-methods");
    },
  });
}

export type BkashGatewayConfig = {
  methodNameEn: string;
  methodNameBn: string;
  descriptionEn: string;
  descriptionBn: string;
  logoUrl: string;
} | null;

// Public — null whenever the bKash online gateway is off or half-configured,
// which is exactly when checkout must fall back to the manual bKash method
// (or hide bKash entirely, if no manual config exists either).
export function useBkashGatewayConfig() {
  return useQuery({
    queryKey: ["bkash-gateway-config"],
    queryFn: async () => proxyFetch<BkashGatewayConfig>("/payments/bkash/config"),
  });
}

export interface SubmitManualPaymentInput {
  orderId: number;
  method: "bkash" | "nagad" | "rocket" | "upay";
  senderMsisdn: string;
  trxId: string;
  amount: number;
  screenshotUrl?: string;
}

export function useSubmitManualPayment() {
  return useMutation({
    mutationFn: async (input: SubmitManualPaymentInput) => {
      return proxyFetch<unknown>("/net-profit/manual-payments", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
  });
}

// Multipart upload — kept as a plain fetch (not the typed api client) since
// openapi-fetch's generated body type for this route doesn't model
// FormData; the backend endpoint itself is real and already verified via
// the admin-side equivalent pattern (media upload).
export function useUploadPaymentScreenshot() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${baseUrl}/api/v1/net-profit/manual-payments/screenshot`, { method: "POST", body: form });
      const body = await res.json();
      if (!body.success) throw new Error(body.error?.message ?? "Upload failed");
      return body.data as { url: string };
    },
  });
}
