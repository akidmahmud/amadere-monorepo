import { useMutation } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

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
      return proxyFetch<FraudPreflightResult>("/net-profit/fraud/evaluate", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
    },
  });
}
