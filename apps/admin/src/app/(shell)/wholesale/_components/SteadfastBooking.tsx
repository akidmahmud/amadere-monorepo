"use client";

import { useBookWholesaleSteadfast, useWholesaleOrder } from "@/hooks/useWholesale";

const LIVE = ["PENDING", "DISPATCHED", "IN_TRANSIT", "DELIVERED", "PARTIALLY_DELIVERED"];

/**
 * Courier Steadfast: the booking's status (read fresh), and a button to book
 * it — new orders are booked automatically; this is for a failed booking or
 * an order switched to Steadfast later.
 */
export function SteadfastBooking({
  orderId,
  onBooked,
}: {
  orderId: number;
  /** The tracking code Steadfast gave, so an open edit form doesn't overwrite it. */
  onBooked?: (trackingCode: string) => void;
}) {
  const { data: order } = useWholesaleOrder(orderId);
  const book = useBookWholesaleSteadfast();
  const sh = order?.shipment;
  const live = sh && LIVE.includes(sh.status);
  return (
    <div className="rounded-xl border border-border bg-surface-2 px-3 py-2.5 sm:col-span-2">
      <div className="text-[9px] font-bold uppercase tracking-wide text-muted">Steadfast</div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text">
        <span>
          {sh
            ? `${sh.status.replace(/_/g, " ").toLowerCase()}${sh.trackingCode ? ` · ${sh.trackingCode}` : ""}`
            : "Not booked"}
        </span>
        {order && !live && order.status !== "CANCELLED" && (
          <button
            type="button"
            disabled={book.isPending}
            onClick={() =>
              book.mutate(orderId, {
                onSuccess: (s) => {
                  const code = (s as { trackingCode?: string | null }).trackingCode;
                  if (code) onBooked?.(code);
                },
              })
            }
            className="h-7 rounded-md bg-brand-500 px-2.5 text-[11px] font-bold text-white disabled:opacity-50"
          >
            {book.isPending ? "Booking…" : sh ? "Book again" : "Book with Steadfast"}
          </button>
        )}
      </div>
      {(book.error || (sh?.status === "FAILED" && sh.errorMessage)) && (
        <p className="mt-1 text-[11px] font-semibold text-danger">
          {book.error ? (book.error as Error).message : sh!.errorMessage}
        </p>
      )}
    </div>
  );
}
