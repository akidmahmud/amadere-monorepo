"use client";

import type { ReactNode } from "react";
import { FormProvider } from "react-hook-form";
import { BlockPopup } from "@/components/BlockPopup";
import { CodOtpPopup } from "@/components/CodOtpPopup";
import { CheckoutContextProvider } from "./CheckoutContext";
import { DefaultCheckoutLayout } from "./DefaultCheckoutLayout";
import { OrderPlacedPanel } from "./OrderPlacedPanel";
import { useCheckoutState } from "./useCheckoutState";

/**
 * Owns the form element and the popups; the visual arrangement is `children`.
 *
 * That split is the whole point of Phase 4a: in Phase 4b a Puck layout can
 * replace DefaultCheckoutLayout without any of the brain moving. Falling back
 * to the default layout when given no children is what keeps /checkout
 * identical after the split.
 */
export function CheckoutProvider({ children }: { children?: ReactNode }) {
  const ctx = useCheckoutState();
  const {
    form,
    submitForm,
    showOtpPopup,
    shippingPhone,
    setShowOtpPopup,
    placeOrder,
    placeOrderErrorMessage,
    blockDetails,
    setBlockPopupDismissed,
    preflightBlock,
    setPreflightBlock,
  } = ctx;

  // Short-circuits exactly as the original did: once an order exists there
  // is no form left to render.
  if (ctx.placedOrder) {
    return (
      <OrderPlacedPanel placedOrder={ctx.placedOrder} digitalOnly={ctx.digitalOnly} />
    );
  }

  return (
    <CheckoutContextProvider value={ctx}>
      <FormProvider {...form}>
        <form onSubmit={submitForm} className="mx-auto max-w-[1180px] px-5 py-9">
          {children ?? <DefaultCheckoutLayout />}
        </form>
      {showOtpPopup && (
        <CodOtpPopup
          shippingPhone={shippingPhone}
          onConfirm={submitForm}
          onClose={() => setShowOtpPopup(false)}
          isSubmitting={placeOrder.isPending}
          errorMessage={placeOrderErrorMessage}
        />
      )}
      {blockDetails && <BlockPopup details={blockDetails} onClose={() => setBlockPopupDismissed(true)} />}
      {!blockDetails && preflightBlock && <BlockPopup details={preflightBlock} onClose={() => setPreflightBlock(null)} />}
      </FormProvider>
    </CheckoutContextProvider>
  );
}
