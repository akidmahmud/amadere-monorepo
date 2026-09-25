"use client";

import { use, useEffect, useMemo } from "react";
import {
  usePosSale,
  usePosVat,
  useResolvedInvoice,
  type PosSale,
} from "@/hooks/usePos";
import {
  BUILTIN_POS_INVOICE,
  renderPosInvoice,
  type PosInvoiceData,
} from "@/lib/pos-invoice";

const TENDER: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card",
  BKASH: "Mobile Banking",
};

function toInvoiceData(
  s: PosSale,
  vat:
    | { enabled: boolean; ratePercent: number; pricesIncludeVat: boolean }
    | undefined,
): PosInvoiceData {
  const pay = s.payments[0];
  const total = Number(s.totalAmount);
  const tendered = s.tenderedAmount != null ? Number(s.tenderedAmount) : null;
  const customer = s.customer
    ? {
        name:
          [s.customer.firstName, s.customer.lastName]
            .filter(Boolean)
            .join(" ") || "Customer",
        phone: s.customer.phone,
      }
    : null;
  return {
    store: {
      name: s.store?.name ?? "",
      address: s.store?.address,
      phone: s.store?.phone,
    },
    receiptNo: s.orderNumber,
    createdAt: s.createdAt,
    cashier: s.assignedAdmin
      ? `${s.assignedAdmin.firstName} ${s.assignedAdmin.lastName}`
      : "",
    customer,
    status: s.status,
    items: s.items.map((i) => ({
      name: i.productNameSnapshot,
      variant: i.variantLabel,
      qty: i.quantity,
      unitPrice: Number(i.unitPrice),
      lineTotal: Number(i.unitPrice) * i.quantity,
    })),
    subtotal: Number(s.subTotal),
    discount: Number(s.discountAmount),
    vat: Number(s.taxAmount),
    // ponytail: rate/mode come from today's POS Settings, not stored per sale —
    // a reprint after a VAT-setting change shows the new label (amounts are the stored ones).
    vatRatePercent: vat?.enabled ? vat.ratePercent : 0,
    vatIncluded: vat?.pricesIncludeVat ?? false,
    total,
    paidBy: pay ? (TENDER[pay.provider] ?? pay.provider) : "",
    tendered,
    change: tendered != null ? Math.max(0, tendered - total) : null,
    trxRef: pay?.transactionRef ?? null,
  };
}

/** Receipt in the store's own template (else Default, else built-in). Prints itself; reopening reprints. */
export default function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: sale, error } = usePosSale(Number(id));
  const { data: vat, isSuccess: vatReady } = usePosVat();
  const tpl = useResolvedInvoice(sale?.storeId);

  const html = useMemo(
    () =>
      sale && tpl.isSuccess && vatReady
        ? renderPosInvoice(
            tpl.data.html ?? BUILTIN_POS_INVOICE,
            toInvoiceData(sale, vat),
          )
        : null,
    [sale, tpl.isSuccess, tpl.data, vat, vatReady],
  );

  useEffect(() => {
    if (!html) return;
    const t = setTimeout(() => window.print(), 250);
    return () => clearTimeout(t);
  }, [html]);

  if (error)
    return <div className="p-6 text-sm text-red-600">{error.message}</div>;
  if (!html) return <div className="p-6 text-sm text-gray-500">Loading…</div>;
  return (
    <div className="bg-white">
      <style>{`@page { size: 80mm auto; margin: 0 } @media print { body { background: #fff } }`}</style>
      {/* Template HTML is sanitised on save; every value is escaped by renderPosInvoice. */}
      <div className="pos-receipt" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
