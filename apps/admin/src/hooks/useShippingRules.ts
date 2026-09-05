import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ShippingRulesConfig, ShippingDeliveryType } from "@amader/shared";
import { proxyFetch } from "@/lib/api/proxy-client";

// Typed from @amader/shared rather than the generated OpenAPI schema: the
// rule shape already lives there (the backend DTO and the pure quote
// function both import it), so going through schema.d.ts would only add a
// codegen step between this form and the types it is already editing.

const KEY = ["admin-shipping-rules"];

export interface ShippingRuleQuoteResult {
  amount: number | null;
  ruleId: string | null;
  ruleName: string | null;
  weightKg: number;
  district: string | null;
}

export interface ShippingRuleQuoteInput {
  orderId?: number | null;
  district?: string | null;
  items?: { productId?: number | null; variantId?: number | null; quantity: number }[];
  weightKg?: number | null;
  deliveryType?: ShippingDeliveryType;
}

export function useShippingRules() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => proxyFetch<ShippingRulesConfig>("/admin/shipping-rules"),
  });
}

export function useUpdateShippingRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ShippingRulesConfig) =>
      proxyFetch<ShippingRulesConfig>("/admin/shipping-rules", {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/**
 * The courier's price for a parcel. Advisory everywhere it is shown — the
 * staff member clicks it to accept it, it is never written on their behalf.
 *
 * `enabled` is how callers hold it back until they have an address, since a
 * quote with no district silently prices as the catch-all zone.
 */
export function useShippingRuleQuote(
  input: ShippingRuleQuoteInput,
  enabled = true,
) {
  return useQuery({
    queryKey: ["admin-shipping-rule-quote", input],
    enabled,
    queryFn: () =>
      proxyFetch<ShippingRuleQuoteResult>("/admin/shipping-rules/quote", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}
