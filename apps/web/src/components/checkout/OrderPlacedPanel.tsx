"use client";

import { useEffect, useState } from "react";
import { Button } from "@amader/ui";
import { useRouter } from "@/i18n/navigation";
import { OrderConfirmation } from "@/components/OrderConfirmation";
import { storePlacedOrder } from "@/lib/placed-order";
import type { CheckoutResult } from "@/hooks/useCheckout";

/**
 * The post-order panel, lifted verbatim out of CheckoutForm.
 *
 * It used to be an early `return` in the middle of the component body. That
 * could not survive the brain becoming a hook -- a hook that sometimes
 * returns JSX and sometimes returns state types as
 * `Element | { ... }`, which erased every property on the context.
 *
 * Same markup, same behaviour; the provider now does the short-circuit.
 *
 * PHYSICAL orders only. A digital order never reaches here — the buyer is
 * sent straight to their downloads (or to login, if their email already had
 * an account), because a confirmation screen whose only content is a button
 * to the file is a step between them and the thing they paid for.
 */
export function OrderPlacedPanel({ placedOrder }: { placedOrder: CheckoutResult }) {
  const router = useRouter();
  // Only true when storage refused the hand-off. Then this renders the
  // confirmation inline exactly as it always did — a buyer must never be
  // left staring at a checkout form after paying because their browser
  // blocks sessionStorage.
  const [stayHere, setStayHere] = useState(false);

  useEffect(() => {
    storePlacedOrder(placedOrder);
    // Confirm it actually landed before navigating away from the only copy
    // of the order this browser has.
    let stored = false;
    try {
      stored = sessionStorage.getItem("amader:placed-order") !== null;
    } catch {
      stored = false;
    }
    if (stored) {
      // replace, not push: Back from the thank-you page must not return to a
      // checkout form for an order that is already placed.
      router.replace("/thank-you");
    } else {
      setStayHere(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placedOrder.orderNumber]);

  // Mid-redirect. Rendering the confirmation here too would fire nothing
  // extra (the purchase event is guarded per order), but it would flash the
  // whole panel for a frame before navigating.
  if (!stayHere) {
    return (
      <div className="mx-auto max-w-[1180px] px-5 py-16 text-center">
        <p className="font-body text-muted">Order placed — taking you to your confirmation…</p>
      </div>
    );
  }

  return (
      <div className="mx-auto max-w-[1180px] px-5 py-12">
        <OrderConfirmation order={placedOrder} />
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="ghost" onClick={() => router.push("/products")}>
            Continue Shopping
          </Button>
          <Button variant="green" onClick={() => router.push("/track")}>
            Track Order
          </Button>
        </div>
      </div>
  );
}
