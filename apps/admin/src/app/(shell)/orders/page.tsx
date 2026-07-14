"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@amader/admin-ui";
import { ORDER_STATUSES, useOrders, type OrderStatus } from "@/hooks/useOrders";

export default function OrdersPage() {
  const [status, setStatus] = useState<OrderStatus | undefined>();
  const { data: orders, isLoading } = useOrders(status);

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">{orders?.length ?? 0} orders</p>
        <select
          value={status ?? ""}
          onChange={(e) => setStatus(e.target.value ? (e.target.value as OrderStatus) : undefined)}
          className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        >
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {orders && orders.length === 0 && <p className="text-sm text-muted">No orders.</p>}

      <div className="flex flex-col gap-3">
        {orders?.map((order) => (
          <Link key={order.id} href={`/orders/${order.id}`}>
            <Card className="flex items-center gap-3 hover:border-brand-500">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-text">#{order.orderNumber}</div>
                <div className="text-xs text-muted">
                  {order.status} · {order.items.length} items · {new Date(order.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="num text-sm font-semibold text-text">
                {order.currency} {order.totalAmount}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
