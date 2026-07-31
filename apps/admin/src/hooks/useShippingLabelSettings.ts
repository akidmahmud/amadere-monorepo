import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export interface ShippingLabelSettings {
  enabled: boolean;
  template: string;
  defaultTemplate: string;
}

const KEY = ["admin-shipping-label-settings"];
const BASE = "/admin/shipping-label-settings";

export function useShippingLabelSettings() {
  return useQuery({ queryKey: KEY, queryFn: () => proxyFetch<ShippingLabelSettings>(BASE) });
}

export function useUpdateShippingLabelSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { enabled?: boolean; template?: string }) =>
      proxyFetch<ShippingLabelSettings>(BASE, { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
