"use client";

import { useEffect, useState } from "react";
import { Button } from "@amader/ui";
import { useRouter } from "@/i18n/navigation";
import { OrderConfirmation } from "@/components/OrderConfirmation";
import { readPlacedOrder } from "@/lib/placed-order";
import type { CheckoutResult } from "@/hooks/useCheckout";

/**
 * Where a buyer lands after placing an order.
 *
 * The confirmation used to render in place on /checkout, so the URL still
 * said "checkout" after paying — no landing page to point analytics at, and
 * nothing to return to.
 *
 * The order arrives through sessionStorage rather than a fetch: the order
 * endpoint is behind CustomerJwtGuard and most buyers here are guests, so
 * there is nothing the page could ask the server for. See lib/placed-order.
 *
 * The `purchase` dataLayer event fires from OrderConfirmation, guarded to
 * once per order number — refresh and back-button land here again and must
 * not report a second conversion.
 */
export default function ThankYouPage() {
  const router = useRouter();
  // undefined = still reading storage, null = nothing to show. Distinguished
  // so the page does not flash "no order" before storage has been read.
  const [order, setOrder] = useState<CheckoutResult | null | undefined>(undefined);

  useEffect(() => {
    setOrder(readPlacedOrder());
  }, []);

  if (order === undefined) {
    return (
      <div className="mx-auto max-w-[1180px] px-5 py-16 text-center">
        <p className="font-body text-muted">Loading your order…</p>
      </div>
    );
  }

  // Reached directly, or storage was cleared. /track is the honest way back
  // to an order this browser no longer holds.
  if (!order) {
    return (
      <div className="mx-auto max-w-[1180px] px-5 py-16 text-center">
        <h1 className="font-ui text-2xl font-extrabold text-ink">No recent order to show</h1>
        <p className="mt-2 font-body text-muted">
          If you have just placed an order, check your email or SMS for the confirmation. You
          can also look it up with your order number and phone.
        </p>
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

  return (
    <div className="mx-auto max-w-[1180px] px-5 py-12">
      <OrderConfirmation order={order} />
      <div className="mt-6 flex flex-wrap justify-center gap-3">
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
