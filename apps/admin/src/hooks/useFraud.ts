import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";

export interface FraudCheck {
  id: number;
  phone: string;
  totalOrders: number;
  delivered: number;
  cancelled: number;
  successRate: number | null;
  riskLevel: RiskLevel;
  breakdown: unknown;
  source: string;
  checkedAt: string;
  expiresAt: string;
}

export interface FraudSaving {
  id: number;
  orderId: number | null;
  phone: string;
  amount: string;
  reason: string;
  createdAt: string;
}

export interface FraudSettings {
  enabled: boolean;
  acceptPercent: number;
  allowNoHistory: boolean;
  advanceEnabled: boolean;
  advanceScoreThreshold: number;
  advanceRequiredPercent: number;
  blockEnabled: boolean;
  cacheTtlHours: number;
  blockMessageEn: string;
  blockMessageBn: string;
  deliveryFallback: number;
}

interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

const CHECKS_KEY = ["net-profit-fraud-checks"];
const SAVINGS_KEY = ["net-profit-fraud-savings"];
const SETTINGS_KEY = ["net-profit-fraud-settings"];

export function useFraudChecks(risk?: RiskLevel) {
  return useQuery({
    queryKey: [...CHECKS_KEY, risk ?? "all"],
    queryFn: () =>
      proxyFetch<Paginated<FraudCheck>>(
        `/admin/net-profit/fraud/checks${risk ? `?risk=${risk}` : ""}`,
      ),
  });
}

export function useFraudCheck(phone: string) {
  return useQuery({
    queryKey: [...CHECKS_KEY, phone],
    queryFn: () => proxyFetch<FraudCheck>(`/admin/net-profit/fraud/checks/${encodeURIComponent(phone)}`),
    enabled: phone.length > 0,
  });
}

export function useRecheckFraud() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (phone: string) =>
      proxyFetch<FraudCheck>(`/admin/net-profit/fraud/checks/${encodeURIComponent(phone)}/recheck`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CHECKS_KEY }),
  });
}

export function useFraudSavings() {
  return useQuery({
    queryKey: SAVINGS_KEY,
    queryFn: () => proxyFetch<Paginated<FraudSaving> & { totalAmount: string }>("/admin/net-profit/fraud/savings"),
  });
}

export function useFraudSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => proxyFetch<FraudSettings>("/admin/net-profit/fraud/settings"),
  });
}

export function useUpdateFraudSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<FraudSettings>) =>
      proxyFetch<FraudSettings>("/admin/net-profit/fraud/settings", {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}
