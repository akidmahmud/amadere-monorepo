import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

// The admin GET and PUT carry the same shape, and UpdateShippingZonesDto is
// the class the controller declares — so it is the name that exists in the
// generated schema. ShippingZonesConfig is a bare interface and never
// reaches it.
export type ShippingZonesConfig = components["schemas"]["UpdateShippingZonesDto"];

const KEY = ["admin-shipping-zones"];

export function useShippingZones() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => proxyFetch<ShippingZonesConfig>("/admin/shipping-zones"),
  });
}

export function useUpdateShippingZones() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ShippingZonesConfig) =>
      proxyFetch<ShippingZonesConfig>("/admin/shipping-zones", {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
