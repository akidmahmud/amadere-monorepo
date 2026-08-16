import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import { ADMIN_ORDERS_KEY } from "./useOrders";
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
  paymentStatus: string | null;
  courierProvider: string | null;
  shipmentId: number | null;
  courierStatus: string | null;
  courierAttempts: OrderManagerCourierAttempt[];
  riskLevel: RiskLevel;
  staffNote: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  assignedAdminId: number | null;
  assignedAdminName: string | null;
  /** Set only in the "Deleted Orders" tab's listing — null everywhere else. */
  deletedAt: string | null;
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

export const ORDER_MANAGER_KEY = ["net-profit-order-manager"];
const KEY = ORDER_MANAGER_KEY;

function toQueryString(filters: object): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== "") params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

// New orders placed by other customers/staff wouldn't otherwise show up
// here until a manual reload — polling closes that gap without needing a
// websocket/SSE channel.
const LIST_REFETCH_INTERVAL_MS = 15_000;

export function useOrderManagerList(filters: OrderManagerFilters) {
  return useQuery({
    queryKey: [...KEY, filters],
    queryFn: () => proxyFetch<Paginated<OrderManagerRow>>(`/admin/net-profit/orders${toQueryString(filters)}`),
    refetchInterval: LIST_REFETCH_INTERVAL_MS,
  });
}

// "Deleted Orders" tab — same filters/shape as the main list, just the
// soft-deleted set. No polling (unlike the live working list above): this
// view isn't something anyone watches in real time.
export function useDeletedOrdersList(filters: OrderManagerFilters) {
  return useQuery({
    queryKey: [...KEY, "trash", filters],
    queryFn: () => proxyFetch<Paginated<OrderManagerRow>>(`/admin/net-profit/orders/trash${toQueryString(filters)}`),
  });
}

// Counts per status honoring every OTHER active filter — powers the
// status pill-tabs' live counts (Order Manager parity).
export function useOrderManagerStatusCounts(filters: Omit<OrderManagerFilters, "status" | "page" | "pageSize">) {
  return useQuery({
    queryKey: [...KEY, "status-counts", filters],
    queryFn: () => proxyFetch<Record<string, number>>(`/admin/net-profit/orders/status-counts${toQueryString(filters)}`),
    refetchInterval: LIST_REFETCH_INTERVAL_MS,
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
    // Also invalidates admin-orders — OrderDetailModal's useOrder(id) reads
    // from that key, not this module's, so without this the modal keeps
    // showing the pre-save note until something else happens to refetch it.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ADMIN_ORDERS_KEY });
    },
  });
}

export function useBulkOrderAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      orderIds: number[];
      action: "consign" | "block" | "hold" | "export" | "delete" | "restore" | "assign";
      courierProvider?: string;
      assignedAdminId?: number | null;
    }) => proxyFetch<BulkActionResult>("/admin/net-profit/orders/bulk", { method: "POST", body: JSON.stringify(input) }),
    // Both the working list and the trash list move rows between each other
    // on delete/restore — invalidating just KEY (which the trash query key
    // extends via [...KEY, "trash", ...]) covers both in one call.
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useAssignOrder(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assignedAdminId: number | null) =>
      proxyFetch(`/admin/net-profit/orders/${id}/assign`, { method: "PATCH", body: JSON.stringify({ assignedAdminId }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ADMIN_ORDERS_KEY });
    },
  });
}
