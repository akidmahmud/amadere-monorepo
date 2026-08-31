"use client";

import { use, useEffect } from "react";
import { useWholesaleOrder } from "@/hooks/useWholesale";
import { WholesaleInvoiceDocument } from "@/components/wholesale/WholesaleInvoiceDocument";

// Outside the app shell, exactly like print/orders/[id]/invoice — print and
// save-as-PDF both go through the browser's own print dialog (no PDF library
// in this codebase; the dialog's "Save as PDF" destination is the download).
export default function WholesaleInvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: order, isLoading, error } = useWholesaleOrder(Number(id));

  useEffect(() => {
    // ?preview=1 skips the auto-print dialog — useful to just look at it.
    if (order && !new URLSearchParams(window.location.search).has("preview")) {
      setTimeout(() => window.print(), 300);
    }
  }, [order]);

  if (error) {
    return (
      <p className="p-8 text-sm text-danger">
        {error instanceof Error ? error.message : "Couldn't load that order"}
      </p>
    );
  }
  if (isLoading || !order)
    return <p className="p-8 text-sm text-muted">Loading…</p>;

  return <WholesaleInvoiceDocument order={order} />;
}
