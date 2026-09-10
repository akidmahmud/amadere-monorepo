"use client";

import { useState } from "react";
import { Card, Icon } from "@amader/admin-ui";
import { WholesaleInvoiceDocument } from "@/components/wholesale/WholesaleInvoiceDocument";
import type { InvoiceSettings } from "@/hooks/useInvoiceSettings";
import type { WholesaleOrder } from "@/hooks/useWholesale";

/**
 * A stand-in order, so the preview has something to print.
 *
 * Made up on purpose rather than pulling a real order: this screen is often
 * open on a shared display while settings are demonstrated, and a real
 * invoice would put a real buyer's name, phone and address on it.
 */
const SAMPLE: WholesaleOrder = {
  id: 0,
  orderNumber: "WS-0000-0000",
  partyId: 0,
  customerName: "Sample Traders",
  customerPhone: "01700000000",
  status: "DELIVERED",
  type: "WHOLESALE",
  channel: "WHATSAPP",
  paymentMethod: "BKASH",
  paymentStatus: "PARTIALLY_PAID",
  transactionId: "BKS-000000",
  gpNumber: null,
  courier: "SUNDARBAN",
  consignmentId: "SB-000000",
  delivery: {
    recipientName: "Sample Traders",
    recipientPhone: "01700000000",
    alternativePhone: null,
    recipientEmail: null,
    addressLine: "12 Example Road, Shop 4",
    district: "Dhaka",
    thana: "Mirpur",
    landmark: "Beside the sample bank",
    postCode: "1216",
  },
  subtotal: "4750.00",
  deliveryCharge: "150.00",
  discount: "250.00",
  total: "4650.00",
  paid: "3000.00",
  due: "1650.00",
  invoiceDocNo: "AR-0000-0000",
  note: "This is a preview. No such order exists.",
  placedAt: new Date().toISOString(),
  items: [
    {
      id: 1,
      productId: null,
      variantId: null,
      name: "Sample Product — 1kg",
      sku: "SAMPLE-1KG",
      unitPrice: "380.00",
      quantity: 10,
      discount: "200.00",
      lineTotal: "3600.00",
      imageUrl: null,
    },
    {
      id: 2,
      productId: null,
      variantId: null,
      name: "Sample Product — 500g",
      sku: "SAMPLE-500G",
      unitPrice: "230.00",
      quantity: 5,
      discount: "0.00",
      lineTotal: "1150.00",
      imageUrl: null,
    },
  ],
};

/**
 * Live preview of the invoice, rendered from the settings currently in the
 * form — including edits that have not been saved yet.
 *
 * This is the REAL invoice component, not a mock of it. A hand-drawn preview
 * would be a second layout to keep in step with the first, and the moment it
 * drifted it would start lying about what the printer produces.
 */
export function InvoicePreview({ draft }: { draft: InvoiceSettings }) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-ui text-sm font-bold text-text">Preview</h3>
          <p className="mt-0.5 text-xs text-muted">
            A sample invoice drawn with the settings above, unsaved changes
            included. No real order or customer is used.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-bold text-secondary transition-colors hover:bg-surface-2"
          aria-expanded={open}
        >
          <Icon name={open ? "visibility_off" : "visibility"} size={16} />
          {open ? "Hide preview" : "Show preview"}
        </button>
      </div>

      {open && (
        // The invoice is laid out for paper, so it is shrunk to fit the
        // settings column. `zoom` rather than `scale`: a transform does not
        // affect layout, so a scaled invoice still reserves its full height
        // and leaves a slab of empty box underneath it.
        <div className="rounded-xl border border-border bg-neutral-100 p-4 dark:bg-neutral-800">
          <div
            className="mx-auto overflow-x-auto bg-white shadow-sm"
            style={{ zoom: 0.8 }}
          >
            <WholesaleInvoiceDocument order={SAMPLE} settingsOverride={draft} />
          </div>
        </div>
      )}
    </Card>
  );
}
