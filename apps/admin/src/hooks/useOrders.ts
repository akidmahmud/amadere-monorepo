import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

export type OrderStatus = "PENDING" | "CONFIRMED" | "PROCESSING" | "COMPLETED" | "CANCELED" | "PARTIALLY_RETURNED" | "RETURNED" | "HOLD";
export const ORDER_STATUSES: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "COMPLETED",
  "CANCELED",
  "PARTIALLY_RETURNED",
  "RETURNED",
  "HOLD",
];

// status/type/provider fields on nested DTOs are also erased by the same
// swagger gap (only OrderDto.status is overridden here — nested statuses on
// items/payments/history/addresses are just displayed as-is, never set by
// this app, so a full re-type isn't needed for those).
export type AdminOrder = Omit<components["schemas"]["OrderDto"], "status"> & { status: OrderStatus };

const KEY = ["admin-orders"];

export function useOrder(id: number | null) {
  return useQuery({
    queryKey: [...KEY, "detail", id],
    queryFn: () => proxyFetch<AdminOrder>(`/admin/orders/${id}`),
    enabled: id !== null && Number.isFinite(id),
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

export interface CreateManualOrderAddress {
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

export interface CreateManualOrderInput {
  customerId?: number;
  channel: "WHATSAPP" | "PHONE" | "MARKETPLACE" | "POS";
  shippingAddress: CreateManualOrderAddress;
  billingAddress?: CreateManualOrderAddress;
  items: { productId: number; variantId?: number; quantity: number; unitPrice?: number }[];
  paymentProvider: "COD" | "BKASH" | "NAGAD" | "ROCKET" | "UPAY";
  customerNote?: string;
}

export function useCreateManualOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateManualOrderInput) =>
      proxyFetch<AdminOrder>("/admin/orders", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
