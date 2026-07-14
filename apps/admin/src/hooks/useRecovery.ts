import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export interface IncompleteOrder {
  id: number;
  customerId: number | null;
  phone: string | null;
  email: string | null;
  cart: { name: string; quantity: number; unitPrice: string }[];
  subtotal: string;
  stage: string;
  recovered: boolean;
  recoveredOrderId: number | null;
  recoveryAttempts: number;
  lastSeenAt: string;
  createdAt: string;
}

export interface RecoveryRate {
  total: number;
  recovered: number;
  ratePercent: number;
  recoveredValue: string;
}

export interface RecoverySettings {
  enabled: boolean;
  delayHours: number;
  maxAttempts: number;
  quietHoursStart: number;
  quietHoursEnd: number;
}

interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

const LIST_KEY = ["net-profit-recovery"];
const RATE_KEY = ["net-profit-recovery-rate"];
const SETTINGS_KEY = ["net-profit-recovery-settings"];

export function useIncompleteOrders() {
  return useQuery({ queryKey: LIST_KEY, queryFn: () => proxyFetch<Paginated<IncompleteOrder>>("/admin/net-profit/recovery") });
}

export function useRecoveryRate() {
  return useQuery({ queryKey: RATE_KEY, queryFn: () => proxyFetch<RecoveryRate>("/admin/net-profit/recovery/rate") });
}

export function useSendRecovery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch(`/admin/net-profit/recovery/${id}/send`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}

export function useRecoverySettings() {
  return useQuery({ queryKey: SETTINGS_KEY, queryFn: () => proxyFetch<RecoverySettings>("/admin/net-profit/recovery/settings") });
}

export function useUpdateRecoverySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<RecoverySettings>) =>
      proxyFetch<RecoverySettings>("/admin/net-profit/recovery/settings", { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}
