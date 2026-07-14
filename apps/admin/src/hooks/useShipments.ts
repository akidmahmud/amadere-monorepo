import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

export type ShipmentProvider = "STEADFAST" | "PATHAO" | "REDX" | "ECOURIER";
export const SHIPMENT_PROVIDERS: ShipmentProvider[] = ["STEADFAST", "PATHAO", "REDX", "ECOURIER"];

export type Shipment = components["schemas"]["ShipmentDto"];

type Paginated<T> = { items?: T[]; total?: number };
const KEY = ["admin-shipments"];

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
}

export function useDispatchShipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DispatchShipmentInput) =>
      proxyFetch<Shipment>("/admin/shipments/dispatch", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
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
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
