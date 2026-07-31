"use client";

import { use, useEffect } from "react";
import { useOrder } from "@/hooks/useOrders";
import { LabelDocument } from "@/components/orders/LabelDocument";

export default function ShippingLabelPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: order, isLoading } = useOrder(Number(id));

  useEffect(() => {
    if (order) setTimeout(() => window.print(), 300);
  }, [order]);

  if (isLoading || !order) return <p className="p-8 text-sm text-muted">Loading…</p>;

  return <LabelDocument order={order} />;
}
