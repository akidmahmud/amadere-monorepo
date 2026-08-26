import type { PageKind } from "./types";

/**
 * Blocks a CHECKOUT layout cannot be published without (plan §7.2 step 2).
 *
 * Publishing a checkout that cannot take payment, or has no submit button, is
 * the failure this list exists to make impossible — §6.2.3 turns a missing
 * entry into a 422 naming it, rather than letting a customer discover it.
 */
export const REQUIRED_CHECKOUT_BLOCKS = [
  "CheckoutPaymentMethod",
  "CheckoutOrderSummary",
  "CheckoutTerms",
  "CheckoutPlaceOrder",
] as const;

/**
 * At least ONE of these must be present, not both and not a specific one.
 *
 * The same layout serves physical and digital carts, and the provider decides
 * at runtime which of the two renders (`digitalOnly`). Requiring both would
 * reject a legitimate digital-goods-only shop; requiring neither would allow a
 * checkout that collects no address and no contact details at all.
 */
export const REQUIRED_CHECKOUT_BLOCKS_ONE_OF = [
  "CheckoutShippingAddress",
  "CheckoutContactDetails",
] as const;

/** Human-readable names for the 422 message — "Place Order Button" tells the
 *  owner what to drag in; "CheckoutPlaceOrder" tells them we leaked an
 *  identifier. */
export const BLOCK_LABELS: Record<string, string> = {
  CheckoutPaymentMethod: "Payment Method",
  CheckoutOrderSummary: "Order Summary",
  CheckoutTerms: "Terms Agreement",
  CheckoutPlaceOrder: "Place Order Button",
  CheckoutShippingAddress: "Shipping Address",
  CheckoutContactDetails: "Contact Details",
};

export function blockLabel(name: string): string {
  return BLOCK_LABELS[name] ?? name;
}

export function requiredBlocksFor(kind: PageKind): readonly string[] {
  return kind === "CHECKOUT" ? REQUIRED_CHECKOUT_BLOCKS : [];
}
