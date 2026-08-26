"use client";

import { createContext, useContext } from "react";
import type { useCheckoutState } from "./useCheckoutState";

/**
 * Derived from the brain rather than hand-written. The member list came from
 * analysing what the markup actually referenced, and restating it here would
 * be a second copy to keep in sync -- and would erase the prop types the
 * markup depends on.
 */
export type CheckoutContextValue = ReturnType<typeof useCheckoutState>;

const CheckoutContext = createContext<CheckoutContextValue | null>(null);

export const CheckoutContextProvider = CheckoutContext.Provider;

/**
 * Throws rather than returning null on purpose (plan §7.2 step 1): a checkout
 * block rendered outside the provider is a mis-built page, and it must fail
 * loudly in the editor instead of silently at 2am.
 */
export function useCheckoutContext(): CheckoutContextValue {
  const ctx = useContext(CheckoutContext);
  if (!ctx) {
    throw new Error(
      "A checkout block was rendered outside <CheckoutProvider>. Every " +
        "checkout block must live inside the checkout root.",
    );
  }
  return ctx;
}
