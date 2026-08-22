import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

export type PublicShippingZone = components["schemas"]["PublicShippingZoneDto"];

// Public and unauthenticated — no cart identity involved, so the raw typed
// client is correct here (unlike the cart/checkout calls, which need the
// Bearer token this app's proxy attaches).
export function useShippingZones(locale: string) {
  return useQuery({
    queryKey: ["shipping-zones", locale],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/shipping-zones", {
        params: { query: { locale: locale as "EN" | "BN" } },
      });
      if (error) throw error;
      return data;
    },
    // Rates change when an admin edits them, which is rare — but they must
    // not be stale enough to contradict the fee in the order total.
    staleTime: 5 * 60 * 1000,
  });
}
