"use client";

import { CheckoutProvider } from "./checkout/CheckoutProvider";

/**
 * Thin shell kept at the original path so nothing that imports CheckoutForm
 * has to change.
 *
 * The brain moved to CheckoutProvider and the arrangement to
 * DefaultCheckoutLayout (plan §7.2). The provider renders the default layout
 * when given no children, which is what keeps /checkout byte-identical after
 * the split.
 */
export function CheckoutForm() {
  return <CheckoutProvider />;
}
