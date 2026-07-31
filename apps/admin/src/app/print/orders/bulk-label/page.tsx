"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQueries } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import { ADMIN_ORDERS_KEY, type AdminOrder } from "@/hooks/useOrders";
import { LabelDocument } from "@/components/orders/LabelDocument";

// Bulk equivalent of the single-order label print page — same
// one-page-per-order stack + browser print dialog pattern as bulk-invoice.
function BulkLabelPrintPageInner() {
  const searchParams = useSearchParams();
  const ids = (searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));

  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: [...ADMIN_ORDERS_KEY, "detail", id],
      queryFn: () => proxyFetch<AdminOrder>(`/admin/orders/${id}`),
    })),
  });

  const orders = results.map((r) => r.data).filter((o): o is AdminOrder => !!o);
  const allSettled = results.every((r) => r.isSuccess || r.isError);

  useEffect(() => {
    if (allSettled && orders.length > 0) setTimeout(() => window.print(), 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSettled, orders.length]);

  if (ids.length === 0) return <p className="p-8 text-sm text-muted">No orders selected.</p>;
  if (!allSettled) {
    const loaded = results.filter((r) => r.isSuccess).length;
    return <p className="p-8 text-sm text-muted">Loading labels ({loaded}/{ids.length})…</p>;
  }
  if (orders.length === 0) return <p className="p-8 text-sm text-muted">Couldn't load any of the selected orders.</p>;

  return (
    <div>
      {orders.map((order, idx) => (
        <div key={order.id} style={idx < orders.length - 1 ? { breakAfter: "page" } : undefined}>
          <LabelDocument order={order} />
        </div>
      ))}
    </div>
  );
}

export default function BulkLabelPrintPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted">Loading…</p>}>
      <BulkLabelPrintPageInner />
    </Suspense>
  );
}
