import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { RiskLevel } from "./useFraud";

export interface OrderManagerRow {
  id: number;
  orderNumber: string;
  status: string;
  totalAmount: string;
  createdAt: string;
  shippingPhone: string | null;
  division: string | null;
  paymentProvider: string | null;
  courierProvider: string | null;
  riskLevel: RiskLevel;
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
}

const KEY = ["net-profit-order-manager"];

function toQueryString(filters: OrderManagerFilters): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) params.set(k, v);
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

export interface BulkActionResult {
  succeeded: number[];
  failed: { orderId: number; error: string }[];
  csv?: string;
}

export function useBulkOrderAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { orderIds: number[]; action: "consign" | "block" | "hold" | "export"; courierProvider?: string }) =>
      proxyFetch<BulkActionResult>("/admin/net-profit/orders/bulk", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
