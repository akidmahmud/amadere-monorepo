import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export type PaymentMethodProvider = "BKASH" | "NAGAD" | "ROCKET" | "UPAY";
export type PaymentAccountType = "PERSONAL" | "AGENT" | "MERCHANT";

export type AssignableOrderStatus = "PENDING" | "CONFIRMED" | "PROCESSING" | "COMPLETED" | "CANCELED" | "PARTIALLY_RETURNED" | "RETURNED" | "HOLD";

export interface PaymentMethodConfig {
  id: number;
  provider: PaymentMethodProvider;
  accountType: PaymentAccountType;
  number: string;
  instructionsEn: string | null;
  instructionsBn: string | null;
  iconUrl: string | null;
  showIcon: boolean;
  orderStatusAfterVerify: AssignableOrderStatus;
  isActive: boolean;
}

const KEY = ["net-profit-payment-methods"];

export function usePaymentMethodConfigs() {
  return useQuery({ queryKey: KEY, queryFn: () => proxyFetch<PaymentMethodConfig[]>("/admin/net-profit/payment-methods") });
}

export function useUpsertPaymentMethodConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      provider: PaymentMethodProvider;
      accountType: PaymentAccountType;
      number: string;
      instructionsEn?: string;
      instructionsBn?: string;
      iconUrl?: string;
      showIcon?: boolean;
      orderStatusAfterVerify?: AssignableOrderStatus;
      isActive?: boolean;
    }) => proxyFetch<PaymentMethodConfig>("/admin/net-profit/payment-methods", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
