"use client";

import { useState } from "react";
import { Button, Input } from "@amader/ui";
import { OrderConfirmation } from "@/components/OrderConfirmation";
import { useTrackOrder } from "@/hooks/useCheckout";

export function TrackOrderForm() {
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const track = useTrackOrder();

  if (track.data) {
    return (
      <div className="mx-auto max-w-[1180px] px-5 py-12">
        <OrderConfirmation order={track.data} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-5 py-16 text-center">
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
          <Input placeholder="017*********" value={phone} onChange={(e) => setPhone(e.target.value)} />
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
  );
}
