import type { AdminOrder } from "@/hooks/useOrders";
import { useInvoiceSettings, type InvoiceDateFormat } from "@/hooks/useInvoiceSettings";

function formatInvoiceDate(value: string | Date, format: InvoiceDateFormat): string {
  const date = new Date(value);
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const y = date.getFullYear();
  if (format === "DMY") return `${d}/${m}/${y}`;
  if (format === "YMD") return `${y}-${m}-${d}`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Shared by the single-order print page (print/orders/[id]/invoice) and the
// bulk print page (print/orders/bulk-invoice) — same invoice layout either
// way, just one-per-page vs. stacked-with-page-breaks. Company info, date
// format, invoice prefix, and the confirmed-order gate all come from
// Settings > Invoices (useInvoiceSettings) so every invoice, wherever it's
// printed from, reflects the same site-wide configuration.
export function InvoiceDocument({ order }: { order: AdminOrder }) {
  const { data: settings } = useInvoiceSettings();
  const shipping = order.addresses.find((a) => (a.type as unknown as string) === "SHIPPING");
  const billing = order.addresses.find((a) => (a.type as unknown as string) === "BILLING") ?? shipping;
  const latestPayment = order.payments[order.payments.length - 1];

  if (settings?.disableUntilConfirmed && (order.status as unknown as string) === "PENDING") {
    return (
      <div className="mx-auto max-w-3xl p-10 text-center text-sm text-black print:p-0">
        <p className="text-base font-semibold">Invoice not available</p>
        <p className="text-muted">Order {order.orderNumber} hasn&apos;t been confirmed yet.</p>
      </div>
    );
  }

  const companyName = settings?.companyName || "Amader";
  const dateFormat = settings?.dateFormat ?? "MDY";

  return (
    <div className="mx-auto max-w-3xl p-10 text-sm text-black print:p-0">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoice</h1>
          <p className="text-muted">{settings?.invoicePrefix}{order.orderNumber}</p>
          <p className="text-muted">{formatInvoiceDate(order.createdAt, dateFormat)}</p>
        </div>
        <div className="text-right">
          {settings?.companyLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.companyLogoUrl} alt={companyName} className="ml-auto mb-1 h-12 object-contain" />
          ) : (
            <div className="text-lg font-bold">{companyName}</div>
          )}
          {settings?.companyAddress && <p className="text-xs text-muted">{settings.companyAddress}</p>}
          {settings?.companyEmail && <p className="text-xs text-muted">{settings.companyEmail}</p>}
          {settings?.companyPhone && <p className="text-xs text-muted">{settings.companyPhone}</p>}
          {settings?.companyTaxId && <p className="text-xs text-muted">Tax ID: {settings.companyTaxId}</p>}
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-8">
        <div>
          <p className="mb-1 text-xs font-bold uppercase text-muted">Bill to</p>
          <p className="font-semibold">{billing?.recipientName}</p>
          <p>{billing?.phone}</p>
          <p>{billing?.addressLine}</p>
          <p>{[billing?.area, billing?.district, billing?.division, billing?.postCode].filter(Boolean).join(", ")}</p>
        </div>
        <div>
          <p className="mb-1 text-xs font-bold uppercase text-muted">Ship to</p>
          <p className="font-semibold">{shipping?.recipientName}</p>
          <p>{shipping?.phone}</p>
          <p>{shipping?.addressLine}</p>
          <p>{[shipping?.area, shipping?.district, shipping?.division, shipping?.postCode].filter(Boolean).join(", ")}</p>
        </div>
      </div>

      <table className="mb-6 w-full border-collapse text-left">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="py-2">Item</th>
            <th className="py-2 text-right">Price</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-border">
              <td className="py-2">{item.name} {item.sku && <span className="text-muted">({item.sku})</span>} {item.weight && <span className="text-muted">— {item.weight} kg</span>}</td>
              <td className="py-2 text-right">{order.currency} {item.unitPrice}</td>
              <td className="py-2 text-right">{item.quantity}</td>
              <td className="py-2 text-right">{order.currency} {(Number(item.unitPrice) * item.quantity).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-start justify-between">
        {settings?.stampEnabled && settings.stampImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={settings.stampImageUrl} alt="Stamp" className="h-24 w-24 object-contain opacity-90" />
        )}
        <div className="ml-auto flex w-64 flex-col gap-1">
          <div className="flex justify-between"><span>Sub amount</span><span>{order.currency} {order.subTotal}</span></div>
          {Number(order.discountAmount) > 0 && (
            <div className="flex justify-between">
              <span>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</span>
              <span>-{order.currency} {order.discountAmount}</span>
            </div>
          )}
          {Number(order.taxAmount) > 0 && <div className="flex justify-between"><span>Tax</span><span>{order.currency} {order.taxAmount}</span></div>}
          {Number(order.codFee) > 0 && <div className="flex justify-between"><span>COD Fee</span><span>{order.currency} {order.codFee}</span></div>}
          {Number(order.shippingAmount) > 0 && <div className="flex justify-between"><span>Shipping fee</span><span>{order.currency} {order.shippingAmount}</span></div>}
          <div className="flex justify-between border-t-2 border-black pt-1 text-base font-bold">
            <span>Total amount</span><span>{order.currency} {order.totalAmount}</span>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-1 border-t border-border pt-4">
        <div className="flex justify-between"><span>Payment method</span><span>{latestPayment ? String(latestPayment.provider) : "—"}</span></div>
        <div className="flex justify-between"><span>Payment status</span><span>{latestPayment ? String(latestPayment.status) : "—"}</span></div>
      </div>
    </div>
  );
}
