"use client";

import { use, useEffect } from "react";
import { useOrder } from "@/hooks/useOrders";
import { InvoiceDocument } from "@/components/orders/InvoiceDocument";

// No app shell here (this route is outside apps/admin/src/app/(shell)) —
// print/save-as-PDF is done via the browser's own print dialog rather than a
// server-generated PDF (no PDF library exists in this codebase; the browser
// already does this natively for both "Print invoice" and "Download
// invoice", the latter via the dialog's "Save as PDF" destination).
export default function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: order, isLoading } = useOrder(Number(id));

  useEffect(() => {
    if (order) setTimeout(() => window.print(), 300);
  }, [order]);

  if (isLoading || !order) return <p className="p-8 text-sm text-muted">Loading…</p>;

  return <InvoiceDocument order={order} />;
}
