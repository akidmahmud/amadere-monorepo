import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export interface AdvancePayment {
  id: number;
  orderId: number;
  required: string;
  paid: string;
  status: "PENDING" | "PARTIAL" | "PAID" | "WAIVED";
  reason: string | null;
  createdAt: string;
}

export interface ManualPayment {
  id: number;
  orderId: number;
  method: string;
  senderMsisdn: string;
  trxId: string;
  amount: string;
  screenshotUrl: string | null;
  status: "SUBMITTED" | "VERIFIED" | "REJECTED";
  verifiedBy: number | null;
  createdAt: string;
}

export interface AdvancePaymentSettings {
  alwaysOnEnabled: boolean;
  type: "fixed" | "percent";
  value: number;
  label: string;
}

interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

const ADVANCE_KEY = ["net-profit-advance"];
const MANUAL_KEY = ["net-profit-manual-payments"];
const ADVANCE_SETTINGS_KEY = ["net-profit-advance-settings"];

export function useAdvancePayments() {
  return useQuery({ queryKey: ADVANCE_KEY, queryFn: () => proxyFetch<Paginated<AdvancePayment>>("/admin/net-profit/advance") });
}

export function useAdvancePayment(orderId: number | null) {
  return useQuery({
    queryKey: [...ADVANCE_KEY, orderId],
    queryFn: () => proxyFetch<AdvancePayment | null>(`/admin/net-profit/advance/${orderId}`),
    enabled: orderId !== null,
  });
}

export function useWaiveAdvance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: number) => proxyFetch(`/admin/net-profit/advance/${orderId}/waive`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ADVANCE_KEY }),
  });
}

export function useAdvancePaymentSettings() {
  return useQuery({
    queryKey: ADVANCE_SETTINGS_KEY,
    queryFn: () => proxyFetch<AdvancePaymentSettings>("/admin/net-profit/advance/settings"),
  });
}

export function useUpdateAdvancePaymentSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<AdvancePaymentSettings>) =>
      proxyFetch<AdvancePaymentSettings>("/admin/net-profit/advance/settings", { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: (data) => qc.setQueryData(ADVANCE_SETTINGS_KEY, data),
  });
}

export function useManualPayments() {
  return useQuery({ queryKey: MANUAL_KEY, queryFn: () => proxyFetch<Paginated<ManualPayment>>("/admin/net-profit/payments/manual") });
}

export function useManualPaymentsForOrder(orderId: number | null) {
  return useQuery({
    queryKey: [...MANUAL_KEY, "order", orderId],
    queryFn: () => proxyFetch<Paginated<ManualPayment>>(`/admin/net-profit/payments/manual?orderId=${orderId}`),
    enabled: orderId !== null,
  });
}

export function useVerifyManualPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<ManualPayment>(`/admin/net-profit/payments/manual/${id}/verify`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MANUAL_KEY });
      qc.invalidateQueries({ queryKey: ADVANCE_KEY });
    },
  });
}

export function useRejectManualPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<ManualPayment>(`/admin/net-profit/payments/manual/${id}/reject`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: MANUAL_KEY }),
  });
}
