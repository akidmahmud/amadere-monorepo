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

/**
 * Gateway payments — money a provider captured on its own (bKash PGW and
 * friends), with no admin in the loop.
 *
 * Separate from useManualPayments on purpose: a ManualPayment is a customer
 * CLAIM awaiting verification, while these are already CAPTURED. Nothing in
 * the admin listed them at all before, so a gateway-paid order was marked
 * paid and confirmed with no screen anywhere showing the money or its
 * transaction id.
 */
export interface GatewayPayment {
  id: number;
  orderId: number;
  orderNumber: string;
  provider: string;
  status: string;
  amount: string;
  refundedAmount: string | null;
  transactionRef: string | null;
  createdAt: string;
}

const GATEWAY_KEY = ["net-profit", "payments", "gateway"];

export function useGatewayPayments(params: { provider?: string; status?: string; q?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.provider) qs.set("provider", params.provider);
  if (params.status) qs.set("status", params.status);
  if (params.q) qs.set("q", params.q);
  const suffix = qs.toString() ? `?${qs}` : "";
  return useQuery({
    queryKey: [...GATEWAY_KEY, params],
    queryFn: () =>
      proxyFetch<Paginated<GatewayPayment> & { capturedTotal: string }>(
        `/admin/net-profit/payments/gateway${suffix}`,
      ),
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
