import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export interface CartSnapshotItem {
  productId: number;
  name: string;
  slug: string;
  quantity: number;
  unitPrice: string;
  imageUrl: string | null;
}

export interface IncompleteOrder {
  id: number;
  customerId: number | null;
  phone: string | null;
  email: string | null;
  cart: CartSnapshotItem[];
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

export interface RecoveryFilters {
  recovered?: boolean;
  q?: string;
  from?: string;
  to?: string;
}

export interface CreateOrderInput {
  recipientName: string;
  phone: string;
  email?: string;
  division: string;
  district: string;
  area?: string;
  landmark?: string;
  addressLine: string;
  postCode?: string;
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

function toQueryString(filters: RecoveryFilters): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== "") params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function useIncompleteOrders(filters: RecoveryFilters = {}) {
  return useQuery({
    queryKey: [...LIST_KEY, filters],
    queryFn: () => proxyFetch<Paginated<IncompleteOrder>>(`/admin/net-profit/recovery${toQueryString(filters)}`),
  });
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

export function useDeleteIncompleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`/admin/net-profit/recovery/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
      qc.invalidateQueries({ queryKey: RATE_KEY });
    },
  });
}

export function useClearAllIncomplete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (recovered?: boolean) =>
      proxyFetch<{ count: number }>(`/admin/net-profit/recovery/clear${recovered !== undefined ? `?recovered=${recovered}` : ""}`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
      qc.invalidateQueries({ queryKey: RATE_KEY });
    },
  });
}

export function useCreateOrderFromIncomplete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: CreateOrderInput & { id: number }) =>
      proxyFetch<{ orderId: number; orderNumber: string }>(`/admin/net-profit/recovery/${id}/create-order`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
      qc.invalidateQueries({ queryKey: RATE_KEY });
    },
  });
}

export function useImportRecoveryCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/backend/admin/net-profit/recovery/import", { method: "POST", body: form });
      const body = await res.json();
      if (!body.success) throw new Error(body.error?.message ?? "Import failed");
      return body.data as { imported: number; skipped: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}

export function recoveryExportUrl(filters: RecoveryFilters = {}): string {
  return `/api/backend/admin/net-profit/recovery/export${toQueryString(filters)}`;
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
