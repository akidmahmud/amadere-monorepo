"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQueries } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import { ADMIN_ORDERS_KEY, type AdminOrder } from "@/hooks/useOrders";
import { InvoiceDocument } from "@/components/orders/InvoiceDocument";

// Prints every selected order's invoice on one page-per-order stack — the
// browser's own print dialog then produces one combined PDF via "Save as
// PDF" (same no-PDF-library constraint as the single-order invoice page;
// this is the bulk equivalent of that same approach).
function BulkInvoicePrintPageInner() {
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
    return <p className="p-8 text-sm text-muted">Loading invoices ({loaded}/{ids.length})…</p>;
  }
  if (orders.length === 0) return <p className="p-8 text-sm text-muted">Couldn't load any of the selected orders.</p>;

  return (
    <div>
      {orders.map((order, idx) => (
        <div key={order.id} style={idx < orders.length - 1 ? { breakAfter: "page" } : undefined}>
          <InvoiceDocument order={order} />
        </div>
      ))}
    </div>
  );
}

// useSearchParams() (for ?ids=) opts this page out of static rendering
// unless wrapped in Suspense — same reason apps/admin/src/app/(shell)/orders/new/page.tsx does this.
export default function BulkInvoicePrintPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted">Loading…</p>}>
      <BulkInvoicePrintPageInner />
    </Suspense>
  );
}
