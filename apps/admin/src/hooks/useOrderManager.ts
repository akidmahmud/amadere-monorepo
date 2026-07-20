import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { RiskLevel } from "./useFraud";

export interface OrderManagerCourierAttempt {
  provider: string;
  status: string;
  shipmentId: number;
}

export interface OrderManagerRow {
  id: number;
  orderNumber: string;
  status: string;
  totalAmount: string;
  createdAt: string;
  recipientName: string | null;
  shippingPhone: string | null;
  addressLine: string | null;
  district: string | null;
  division: string | null;
  postCode: string | null;
  thumbnailUrl: string | null;
  origin: string;
  paymentProvider: string | null;
  courierProvider: string | null;
  shipmentId: number | null;
  courierStatus: string | null;
  courierAttempts: OrderManagerCourierAttempt[];
  riskLevel: RiskLevel;
  staffNote: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
}

interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OrderManagerFilters {
  status?: string;
  paymentProvider?: string;
  courierProvider?: string;
  risk?: RiskLevel;
  division?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

const KEY = ["net-profit-order-manager"];

function toQueryString(filters: object): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== "") params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function useOrderManagerList(filters: OrderManagerFilters) {
  return useQuery({
    queryKey: [...KEY, filters],
    queryFn: () => proxyFetch<Paginated<OrderManagerRow>>(`/admin/net-profit/orders${toQueryString(filters)}`),
  });
}

// Counts per status honoring every OTHER active filter — powers the
// status pill-tabs' live counts (Order Manager parity).
export function useOrderManagerStatusCounts(filters: Omit<OrderManagerFilters, "status" | "page" | "pageSize">) {
  return useQuery({
    queryKey: [...KEY, "status-counts", filters],
    queryFn: () => proxyFetch<Record<string, number>>(`/admin/net-profit/orders/status-counts${toQueryString(filters)}`),
  });
}

export interface BulkActionResult {
  succeeded: number[];
  failed: { orderId: number; error: string }[];
  csv?: string;
}

export function useUpdateOrderNote(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note: string) =>
      proxyFetch(`/admin/net-profit/orders/${id}/note`, { method: "PATCH", body: JSON.stringify({ note }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useBulkOrderAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { orderIds: number[]; action: "consign" | "block" | "hold" | "export"; courierProvider?: string }) =>
      proxyFetch<BulkActionResult>("/admin/net-profit/orders/bulk", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
