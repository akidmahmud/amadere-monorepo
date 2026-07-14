import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

export type OrderStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "CANCELED" | "PARTIALLY_RETURNED" | "RETURNED";
export const ORDER_STATUSES: OrderStatus[] = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "CANCELED",
  "PARTIALLY_RETURNED",
  "RETURNED",
];

// status/type/provider fields on nested DTOs are also erased by the same
// swagger gap (only OrderDto.status is overridden here — nested statuses on
// items/payments/history/addresses are just displayed as-is, never set by
// this app, so a full re-type isn't needed for those).
export type AdminOrder = Omit<components["schemas"]["OrderDto"], "status"> & { status: OrderStatus };

type Paginated<T> = { items?: T[]; total?: number };
const KEY = ["admin-orders"];

export function useOrders(status?: OrderStatus) {
  return useQuery({
    queryKey: [...KEY, status ?? "all"],
    queryFn: async () => {
      const qs = new URLSearchParams({ pageSize: "100" });
      if (status) qs.set("status", status);
      const res = await proxyFetch<Paginated<AdminOrder>>(`/admin/orders?${qs}`);
      return res.items ?? [];
    },
  });
}

export function useOrder(id: number) {
  return useQuery({
    queryKey: [...KEY, "detail", id],
    queryFn: () => proxyFetch<AdminOrder>(`/admin/orders/${id}`),
    enabled: Number.isFinite(id),
  });
}

export function useUpdateOrderStatus(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { status: OrderStatus; note?: string }) =>
      proxyFetch<AdminOrder>(`/admin/orders/${id}/status`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRefundOrder(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { amount: number; reason?: string }) =>
      proxyFetch<AdminOrder>(`/admin/orders/${id}/refund`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
