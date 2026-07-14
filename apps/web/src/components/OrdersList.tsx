"use client";

import { useState } from "react";
import { Button, formatMoney } from "@amader/ui";
import { OrderConfirmation } from "@/components/OrderConfirmation";
import { useMyOrders } from "@/hooks/useAccount";

export function OrdersList() {
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<number | null>(null);
  const { data, isLoading } = useMyOrders(page);

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
