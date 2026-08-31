"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { proxyFetch } from "@/lib/api/proxy-client";

/**
 * What the customer sees when bKash sends them back here.
 *
 * The gateway's callback lands on the backend (which is what actually
 * captures the payment) and then redirects the browser to
 * `/checkout?bkash=success|failed&order=…`. Without this the customer would
 * arrive at an empty checkout page with no idea whether their money moved,
 * which on a payment flow is not an acceptable place to leave them.
 */
export function BkashReturnNotice() {
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const status = params.get("bkash");
  const orderNumber = params.get("order");
  const paymentID = params.get("paymentID");
  const [restored, setRestored] = useState(false);
  // The effect must fire exactly once per return; React strict mode mounts
  // twice in dev, and a second call would try to cancel an already-cancelled
  // order.
  const attempted = useRef(false);

  // A cancelled payment left the customer with an empty cart, because the
  // cart is emptied when the order is created — before they ever reach bKash.
  // This puts the lines back and cancels that abandoned order.
  useEffect(() => {
    if (status !== "failed" || !paymentID || attempted.current) return;
    attempted.current = true;
    proxyFetch<{ restored: number }>("/orders/restore-cart", {
      method: "POST",
      body: JSON.stringify({ paymentID }),
    })
      .then((res) => {
        if (res.restored > 0) setRestored(true);
        return queryClient.invalidateQueries({ queryKey: ["cart"] });
      })
      .catch(() => {
        // Already restored, already cancelled, or nothing left to put back —
        // the banner below still tells them the payment did not complete.
      });
  }, [status, paymentID, queryClient]);

  if (status !== "success" && status !== "failed") return null;

  const ok = status === "success";
  return (
    <div className="mx-auto max-w-[1180px] px-5 pt-6">
      <div
        role="status"
        className={`rounded-brand border p-4 font-body text-sm ${
          ok ? "border-green/30 bg-green/5 text-green" : "border-red-300 bg-red-50 text-red-700"
        }`}
      >
        {ok ? (
          <>
            <span className="font-semibold">Payment received.</span>{" "}
            {orderNumber ? (
              <>
                Your order <span className="num font-semibold">{orderNumber}</span> is confirmed.
              </>
            ) : (
              <>Your order is confirmed.</>
            )}
          </>
        ) : (
          <>
            <span className="font-semibold">Payment was not completed.</span>{" "}
            {restored ? (
              <>Nothing was charged and your items are back in the cart — you can try again below.</>
            ) : orderNumber ? (
              <>
                Nothing was charged. Order{" "}
                <span className="num font-semibold">{orderNumber}</span> was cancelled — you can
                place it again below.
              </>
            ) : (
              <>Nothing was charged. You can try again below.</>
            )}
          </>
        )}
      </div>
    </div>
  );
}
