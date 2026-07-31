import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

export type ShipmentProvider = "STEADFAST" | "PATHAO" | "REDX" | "ECOURIER";
export const SHIPMENT_PROVIDERS: ShipmentProvider[] = ["STEADFAST", "PATHAO", "REDX", "ECOURIER"];

export type Shipment = components["schemas"]["ShipmentDto"];
export type ShipmentQueueRow = components["schemas"]["ShipmentQueueRowDto"];
export type BalanceOutcome = { unavailable?: false; balance: number } | { unavailable: true };

type Paginated<T> = { items?: T[]; total?: number };
const KEY = ["admin-shipments"];

export function useShipmentQueue(filters: { page?: number; pageSize?: number; search?: string }) {
  return useQuery({
    queryKey: [...KEY, "queue", filters],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (filters.page) qs.set("page", String(filters.page));
      if (filters.pageSize) qs.set("pageSize", String(filters.pageSize));
      if (filters.search) qs.set("search", filters.search);
      return proxyFetch<Paginated<ShipmentQueueRow> & { total: number; page: number; pageSize: number }>(
        `/admin/shipments/queue?${qs}`,
      );
    },
    placeholderData: (prev) => prev,
  });
}

export function useCourierBalance(provider: ShipmentProvider | undefined) {
  return useQuery({
    queryKey: [...KEY, "balance", provider],
    queryFn: () => proxyFetch<BalanceOutcome>(`/admin/shipments/balance?provider=${provider}`),
    enabled: !!provider,
    staleTime: 60_000,
  });
}

export function useShipments(provider?: ShipmentProvider) {
  return useQuery({
    queryKey: [...KEY, provider ?? "all"],
    queryFn: async () => {
      const qs = new URLSearchParams({ pageSize: "100" });
      if (provider) qs.set("provider", provider);
      const res = await proxyFetch<Paginated<Shipment>>(`/admin/shipments?${qs}`);
      return res.items ?? [];
    },
  });
}

export function useShipment(id: number) {
  return useQuery({
    queryKey: [...KEY, "detail", id],
    queryFn: () => proxyFetch<Shipment>(`/admin/shipments/${id}`),
    enabled: Number.isFinite(id),
  });
}

export interface DispatchShipmentInput {
  orderId: number;
  provider: ShipmentProvider;
  pathao?: { storeId: number; recipientCity?: number; recipientZone?: number; recipientArea?: number };
  redx?: { deliveryAreaId: number; pickupStoreId?: number };
  codAmountOverride?: number;
}

export function useDispatchShipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DispatchShipmentInput) =>
      proxyFetch<Shipment>("/admin/shipments/dispatch", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["net-profit-order-manager"] });
    },
  });
}

export interface DispatchBulkResult {
  succeeded: number[];
  failed: { orderId: number; error: string }[];
}

export function useDispatchBulkShipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { orderIds: number[]; provider: ShipmentProvider }) =>
      proxyFetch<DispatchBulkResult>("/admin/shipments/dispatch-bulk", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["net-profit-order-manager"] });
    },
  });
}

export function useTrackShipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<Shipment>(`/admin/shipments/${id}/track`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCancelShipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reasonCode }: { id: number; reasonCode: string }) =>
      proxyFetch<Shipment>(`/admin/shipments/${id}/cancel`, { method: "POST", body: JSON.stringify({ reasonCode }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["net-profit-order-manager"] });
    },
  });
}

export type ShipmentStatus = "PENDING" | "DISPATCHED" | "IN_TRANSIT" | "DELIVERED" | "PARTIALLY_DELIVERED" | "RETURNED" | "CANCELED" | "FAILED";
export const SHIPMENT_STATUSES: ShipmentStatus[] = ["PENDING", "DISPATCHED", "IN_TRANSIT", "DELIVERED", "PARTIALLY_DELIVERED", "RETURNED", "CANCELED", "FAILED"];

export function useUpdateShipmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, note }: { id: number; status: ShipmentStatus; note?: string }) =>
      proxyFetch<Shipment>(`/admin/shipments/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, note }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["net-profit-order-manager"] });
    },
  });
}
