"use client";

import { useState } from "react";
import { Button, formatMoney } from "@amader/ui";
import { OrderConfirmation } from "@/components/OrderConfirmation";
import { useCancelOrder, useMyOrders } from "@/hooks/useAccount";
import { useLocale } from "next-intl";

// Mirrors CUSTOMER_CANCELABLE_STATUSES in the backend's orders.service.ts —
// the backend is the real gate (this just avoids showing a button that
// would 400), so keep these two lists in sync if that set ever changes.
const CANCELABLE_STATUSES = new Set(["PENDING", "CONFIRMED"]);

export function OrdersList() {
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [confirmingCancelId, setConfirmingCancelId] = useState<number | null>(null);
  const { data, isLoading } = useMyOrders(page);
  const cancelOrder = useCancelOrder();
  const locale = useLocale();

  if (isLoading) return <p className="font-body text-sm text-muted">Loading…</p>;
  if (!data || data.items.length === 0) {
    return <p className="font-body text-sm text-muted">You haven&apos;t placed any orders yet.</p>;
  }

  return (
    <div>
      <h2 className="mb-4 font-ui text-[15px] font-semibold text-green">My Orders</h2>
      <div className="space-y-3">
        {data.items.map((order) => (
          <div key={order.id} className="rounded-brand border border-line bg-white p-4">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left"
              onClick={() => setExpanded(expanded === order.id ? null : order.id)}
            >
              <div>
                <p className="font-ui text-sm font-semibold text-ink">{order.orderNumber}</p>
                <p className="font-body text-xs text-muted">
                  {new Date(order.createdAt).toLocaleDateString()} · {order.status as unknown as string}
                </p>
              </div>
              <span className="font-serif font-semibold text-green">{formatMoney(order.totalAmount)}</span>
            </button>
            {expanded === order.id && (
              <div className="mt-4 border-t border-line pt-4">
                <div className="mb-4 flex flex-wrap justify-end gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => window.open(`/${locale}/orders/${order.orderNumber}/invoice`, "_blank")}
                  >
                    Download Invoice
                  </Button>
                  {CANCELABLE_STATUSES.has(order.status as unknown as string) &&
                    (confirmingCancelId === order.id ? (
                      <>
                        <span className="self-center font-body text-xs text-muted">Cancel this order?</span>
                        <Button variant="ghost" onClick={() => setConfirmingCancelId(null)}>
                          No
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={cancelOrder.isPending}
                          onClick={() => cancelOrder.mutate(order.orderNumber, { onSettled: () => setConfirmingCancelId(null) })}
                          className="text-red-600"
                        >
                          {cancelOrder.isPending ? "Canceling…" : "Yes, cancel"}
                        </Button>
                      </>
                    ) : (
                      <Button variant="ghost" onClick={() => setConfirmingCancelId(order.id)}>
                        Cancel Order
                      </Button>
                    ))}
                </div>
                {cancelOrder.isError && (
                  <p className="mb-3 text-right font-body text-xs text-red-600">
                    {cancelOrder.error instanceof Error ? cancelOrder.error.message : "Couldn't cancel this order"}
                  </p>
                )}
                <OrderConfirmation order={order} />
              </div>
            )}
          </div>
        ))}
      </div>
      {data.total > data.pageSize && (
        <div className="mt-5 flex justify-center gap-3">
          <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button
            variant="ghost"
            disabled={page * data.pageSize >= data.total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
