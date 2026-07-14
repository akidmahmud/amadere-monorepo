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
  status: "SUBMITTED" | "VERIFIED" | "REJECTED";
  verifiedBy: number | null;
  createdAt: string;
}

interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

const ADVANCE_KEY = ["net-profit-advance"];
const MANUAL_KEY = ["net-profit-manual-payments"];

export function useAdvancePayments() {
  return useQuery({ queryKey: ADVANCE_KEY, queryFn: () => proxyFetch<Paginated<AdvancePayment>>("/admin/net-profit/advance") });
}

export function useWaiveAdvance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: number) => proxyFetch(`/admin/net-profit/advance/${orderId}/waive`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ADVANCE_KEY }),
  });
}

export function useManualPayments() {
  return useQuery({ queryKey: MANUAL_KEY, queryFn: () => proxyFetch<Paginated<ManualPayment>>("/admin/net-profit/payments/manual") });
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
