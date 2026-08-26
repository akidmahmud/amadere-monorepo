"use client";

import type { ReactNode } from "react";
import { CheckoutSlotsProvider } from "@amader/page-builder/config";
import { CheckoutProvider } from "./CheckoutProvider";
import { checkoutSlots } from "./slots";

/**
 * Mounts the real checkout brain around a builder page that contains checkout
 * blocks, so a landing page can take an order without sending the visitor to
 * /checkout.
 *
 * Only rendered when the page's layout actually uses a checkout block. The
 * provider fetches the cart, payment method config and the customer's saved
 * addresses, and an ordinary content page must not pay for any of that.
 *
 * `children` is the already-server-rendered page. React elements cross the
 * client boundary fine, and context still reaches the checkout blocks inside
 * them — so the page keeps its server-rendered, indexable markup and only the
 * form becomes interactive.
 *
 * The provider supplies the <form>, the COD OTP popup and the block popups, so
 * a block dropped on a landing page gets the identical submission path as
 * /checkout: same validation, same fraud preflight, same OTP, same order
 * mutation. There is deliberately no second implementation of any of that.
 */
export function CheckoutOnPage({ children }: { children: ReactNode }) {
  return (
    <CheckoutSlotsProvider slots={checkoutSlots}>
      <CheckoutProvider>{children}</CheckoutProvider>
    </CheckoutSlotsProvider>
  );
}
