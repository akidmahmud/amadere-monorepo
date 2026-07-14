import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

type PaymentMethodConfigDto = components["schemas"]["PaymentMethodConfigDto"];

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

// Public — merchant number/instructions/icon for each active manual method,
// what checkout renders once the customer picks bKash/Nagad/Rocket/Upay.
export function usePaymentMethodConfigs() {
  return useQuery({
    queryKey: ["payment-method-configs"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/net-profit/payment-methods");
      if (error) throw error;
      return data as PaymentMethodConfigDto[];
    },
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
      const { data, error } = await api.POST("/api/v1/net-profit/manual-payments", { body: input });
      if (error) throw error;
      return data;
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
