import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export type FraudVerdict = "pass" | "needs_advance" | "block";

export interface FraudPreflightResult {
  allowed: boolean;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
  verdict: FraudVerdict;
  hasHistory: boolean;
  successRatePercent: number | null;
  totalOrders: number;
  requireAdvancePercent?: number;
  blockMessage?: { en: string; bn: string };
}

// Live checkout pre-flight (parity with the reference plugin's checkout
// fraud widget) — purely informational client-side; the real gate always
// re-runs server-side inside CheckoutService and can't be bypassed by
// spoofing this response.
export function useCheckoutFraudPreflight() {
  return useMutation({
    mutationFn: async (phone: string) => {
      const { data, error } = await api.POST("/api/v1/net-profit/fraud/evaluate", { body: { phone } });
      if (error) throw error;
      return data as unknown as FraudPreflightResult;
    },
  });
}
