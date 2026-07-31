"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Input } from "@amader/ui";
import { OrderConfirmation } from "@/components/OrderConfirmation";
import { useTrackOrder } from "@/hooks/useCheckout";

// Same breakpoint Tailwind's default `md:` uses — below it, the form (top)
// and result (further down, past a scroll) are far enough apart that a
// customer on a phone may not notice a result appeared at all.
const MOBILE_BREAKPOINT_QUERY = "(max-width: 767px)";

export function TrackOrderForm() {
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const track = useTrackOrder();
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (track.data && window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches) {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [track.data]);

  // Form stays on screen after a lookup (rather than being replaced by the
  // result) so a customer with several orders can immediately search again
  // — change the order number, keep the same phone, submit — without losing
  // their place or having to reload the page.
  return (
    <div className="mx-auto max-w-[1180px] px-5 py-12">
      <div className="mx-auto max-w-md text-center">
        <h1 className="mb-2 font-serif text-2xl font-semibold text-ink">Track Your Order</h1>
        <p className="mb-6 font-body text-sm text-muted">
          Enter your order number and the phone number used at checkout.
        </p>
        <form
          className="space-y-3.5 text-left"
          onSubmit={(e) => {
            e.preventDefault();
            track.mutate({ orderNumber, phone });
          }}
        >
          <div>
            <label className="mb-1.5 block font-ui text-xs font-medium text-ink">Order Number</label>
            <Input
              placeholder="e.g. ORD-20260707-A1B2C3"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block font-ui text-xs font-medium text-ink">Phone Number</label>
            <Input
              type="tel"
              required
              placeholder="017*********"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              pattern="(?:\+?880|0)?1\d{9}"
              title="Enter a valid Bangladeshi mobile number, e.g. 01712345678"
            />
          </div>
          {track.isError && (
            <p className="font-body text-xs text-red-600">
              {track.error instanceof Error ? track.error.message : "Order not found"}
            </p>
          )}
          <Button type="submit" variant="green" block disabled={track.isPending}>
            {track.isPending ? "Looking up…" : "Track Order"}
          </Button>
        </form>
      </div>

      {track.data && (
        <div ref={resultRef} className="mt-12 scroll-mt-4 border-t border-line pt-12">
          <OrderConfirmation order={track.data} />
        </div>
      )}
    </div>
  );
}
