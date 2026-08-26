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

export type OrderChannel =
  | "WEBSITE" | "WHATSAPP" | "PHONE" | "MARKETPLACE" | "POS" | "APP"
  | "FACEBOOK" | "INSTAGRAM" | "TIKTOK" | "YOUTUBE" | "X";
export const ORDER_CHANNELS: OrderChannel[] = [
  "WEBSITE", "WHATSAPP", "PHONE", "FACEBOOK", "INSTAGRAM",
  "TIKTOK", "YOUTUBE", "X", "MARKETPLACE", "POS", "APP",
];

/** Display names — the raw enum leaks into the Origin dropdown otherwise. */
export const ORDER_CHANNEL_LABELS: Record<OrderChannel, string> = {
  WEBSITE: "Website",
  WHATSAPP: "WhatsApp",
  PHONE: "Telemarketing",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  X: "X",
  MARKETPLACE: "Marketplace",
  POS: "In-store POS",
  APP: "App",
};

export type PaymentProviderType = "COD" | "BKASH" | "NAGAD" | "ROCKET" | "UPAY" | "SSLCOMMERZ" | "BANK_TRANSFER";
export const PAYMENT_PROVIDER_TYPES: PaymentProviderType[] = ["COD", "BKASH", "NAGAD", "ROCKET", "UPAY", "SSLCOMMERZ", "BANK_TRANSFER"];

// status/type/provider fields on nested DTOs are also erased by the same
// swagger gap (only OrderDto.status/channel are overridden here — nested
// statuses on items/payments/history/addresses are just displayed as-is,
// never set by this app, so a full re-type isn't needed for those).
export type AdminOrder = Omit<components["schemas"]["OrderDto"], "status" | "channel"> & {
  status: OrderStatus;
  channel: OrderChannel;
};

export const ADMIN_ORDERS_KEY = ["admin-orders"];
const KEY = ADMIN_ORDERS_KEY;

// Not imported from useOrderManager.ts (which itself imports ADMIN_ORDERS_KEY
// above) — importing it here too would be circular. It's a plain array
// compared by content by TanStack Query, so the literal is enough to
// invalidate the same cache entries.
const ORDER_MANAGER_KEY = ["net-profit-order-manager"];
// Same reasoning as ORDER_MANAGER_KEY above — literal rather than imported
// from useShipments.ts to keep this file free of cross-hook imports. The
// Shipments dispatch queue shows Total / pending-COD amounts per order and
// opens this same OrderDetailModal, so an edit there must refresh it.
const SHIPMENTS_KEY = ["admin-shipments"];

// Origin/Payment/Division/Source/Status are also columns on the Order
// Manager list (OrderManagerTable.tsx), so any edit needs to invalidate that
// list's cache too, not just this order's own detail query — otherwise the
// list keeps showing stale values (or, for the inline <select> cells,
// silently reverts to the old value on next render) even though the write
// itself succeeded.
function invalidateOrder(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: KEY });
  qc.invalidateQueries({ queryKey: ORDER_MANAGER_KEY });
  qc.invalidateQueries({ queryKey: SHIPMENTS_KEY });
}

// A courier webhook (status push, or this file's own delivery→Paid payment
// sync) can update this order entirely server-side while an admin has its
// detail modal open — nothing on the frontend ever calls a mutation for
// that, so there's nothing to invalidate this query. Same 15s polling
// useOrderManagerList already uses for the same reason, so the open modal
// converges on real data within 15s instead of staying frozen until closed
// and reopened.
const ORDER_DETAIL_REFETCH_INTERVAL_MS = 15_000;

export function useOrder(id: number | null) {
  return useQuery({
    queryKey: [...KEY, "detail", id],
    queryFn: () => proxyFetch<AdminOrder>(`/admin/orders/${id}`),
    enabled: id !== null && Number.isFinite(id),
    refetchInterval: ORDER_DETAIL_REFETCH_INTERVAL_MS,
  });
}

export function useUpdateOrderStatus(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { status: OrderStatus; note?: string }) =>
      proxyFetch<AdminOrder>(`/admin/orders/${id}/status`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => invalidateOrder(qc),
  });
}

export function useRefundOrder(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { amount: number; reason?: string }) =>
      proxyFetch<AdminOrder>(`/admin/orders/${id}/refund`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => invalidateOrder(qc),
  });
}

export interface CreateManualOrderAddress {
  recipientName: string;
  phone: string;
  alternativePhone?: string;
  email?: string;
  // Not collected from staff — every BD district belongs to exactly one
  // division, so the backend derives it from `district` (see
  // toOrderAddressCreate in apps/backend).
  division?: string;
  district: string;
  // Required — matches CheckoutAddressDto.area (mandatory on real checkout
  // too); this was wrongly optional here, which is what let a blank Thana
  // field through the form only to 400 on submit.
  area: string;
  landmark?: string;
  addressLine: string;
  postCode?: string;
}

export type ManualOrderPaymentStatus = "PENDING" | "AUTHORIZED" | "CAPTURED" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED" | "CANCELED";

export interface CreateManualOrderInput {
  customerId?: number;
  channel:
    | "WHATSAPP" | "PHONE" | "MARKETPLACE" | "POS"
    | "FACEBOOK" | "INSTAGRAM" | "TIKTOK" | "YOUTUBE" | "X";
  shippingAddress: CreateManualOrderAddress;
  billingAddress?: CreateManualOrderAddress;
  items: { productId: number; variantId?: number; quantity: number; unitPrice?: number }[];
  paymentProvider: "COD" | "BKASH" | "NAGAD" | "ROCKET" | "UPAY";
  taxAmount?: number;
  discountAmount?: number;
  promotionAmount?: number;
  shippingAmount?: number;
  couponCode?: string;
  transactionId?: string;
  paymentStatus?: ManualOrderPaymentStatus;
  customerNote?: string;
}

export function useCreateManualOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateManualOrderInput) =>
      proxyFetch<AdminOrder>("/admin/orders", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => invalidateOrder(qc),
  });
}

export interface PreviewCouponResult {
  amount: string;
  error?: string;
}

// Live coupon preview for the New Order form — same discount rules
// (expiry, usage limits, min order amount, product/category scope) the
// real create() call validates against, so the previewed Total amount
// never disagrees with what actually gets charged.
export function usePreviewCoupon(input: {
  couponCode: string;
  items: { productId: number; variantId?: number; quantity: number }[];
  customerId?: number;
}) {
  const enabled = input.couponCode.trim().length > 0 && input.items.length > 0;
  return useQuery({
    queryKey: ["order-coupon-preview", input.couponCode, input.items, input.customerId],
    queryFn: () =>
      proxyFetch<PreviewCouponResult>("/admin/orders/preview-coupon", {
        method: "POST",
        body: JSON.stringify({ couponCode: input.couponCode, items: input.items, customerId: input.customerId }),
      }),
    enabled,
    retry: false,
  });
}

export function useAddOrderItem(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { productId: number; variantId?: number; quantity: number; unitPrice?: number }) =>
      proxyFetch<AdminOrder>(`/admin/orders/${id}/items`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => invalidateOrder(qc),
  });
}

export function useUpdateOrderItem(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: number; quantity: number }) =>
      proxyFetch<AdminOrder>(`/admin/orders/${id}/items/${itemId}`, { method: "PATCH", body: JSON.stringify({ quantity }) }),
    onSuccess: () => invalidateOrder(qc),
  });
}

export function useRemoveOrderItem(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: number) =>
      proxyFetch<AdminOrder>(`/admin/orders/${id}/items/${itemId}`, { method: "DELETE" }),
    onSuccess: () => invalidateOrder(qc),
  });
}

export function useUpdateOrderDetails(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { channel?: OrderChannel; phone?: string; addressLine?: string; division?: string; utmSource?: string }) =>
      proxyFetch<AdminOrder>(`/admin/orders/${id}/details`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => invalidateOrder(qc),
  });
}

export function useUpdateOrderPayment(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { provider?: PaymentProviderType; status?: ManualOrderPaymentStatus }) =>
      proxyFetch<AdminOrder>(`/admin/orders/${id}/payment`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => invalidateOrder(qc),
  });
}

export function useUpdateOrderAmounts(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { discountAmount?: number; shippingAmount?: number; couponCode?: string }) =>
      proxyFetch<AdminOrder>(`/admin/orders/${id}/amounts`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => invalidateOrder(qc),
  });
}

export function useResendOrderConfirmation(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => proxyFetch<{ sent: boolean; reason?: string }>(`/admin/orders/${id}/resend-confirmation`, { method: "POST" }),
    onSuccess: () => invalidateOrder(qc),
  });
}

export function useReorderOrder(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => proxyFetch<AdminOrder>(`/admin/orders/${id}/reorder`, { method: "POST" }),
    onSuccess: () => invalidateOrder(qc),
  });
}
