import type { AdminOrder } from "@/hooks/useOrders";

// Shared by the single-order print page (print/orders/[id]/invoice) and the
// bulk print page (print/orders/bulk-invoice) — same invoice layout either
// way, just one-per-page vs. stacked-with-page-breaks.
export function InvoiceDocument({ order }: { order: AdminOrder }) {
  const shipping = order.addresses.find((a) => (a.type as unknown as string) === "SHIPPING");
  const billing = order.addresses.find((a) => (a.type as unknown as string) === "BILLING") ?? shipping;
  const latestPayment = order.payments[order.payments.length - 1];

  return (
    <div className="mx-auto max-w-3xl p-10 text-sm text-black print:p-0">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoice</h1>
          <p className="text-muted">{order.orderNumber}</p>
          <p className="text-muted">{new Date(order.createdAt).toLocaleString()}</p>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold">Amader</div>
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

      <div className="ml-auto flex w-64 flex-col gap-1">
        <div className="flex justify-between"><span>Sub amount</span><span>{order.currency} {order.subTotal}</span></div>
        {Number(order.discountAmount) > 0 && (
          <div className="flex justify-between">
            <span>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</span>
            <span>-{order.currency} {order.discountAmount}</span>
          </div>
        )}
        {Number(order.taxAmount) > 0 && <div className="flex justify-between"><span>Tax</span><span>{order.currency} {order.taxAmount}</span></div>}
        {Number(order.shippingAmount) > 0 && <div className="flex justify-between"><span>Shipping fee</span><span>{order.currency} {order.shippingAmount}</span></div>}
        <div className="flex justify-between border-t-2 border-black pt-1 text-base font-bold">
          <span>Total amount</span><span>{order.currency} {order.totalAmount}</span>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-1 border-t border-border pt-4">
        <div className="flex justify-between"><span>Payment method</span><span>{latestPayment ? String(latestPayment.provider) : "—"}</span></div>
        <div className="flex justify-between"><span>Payment status</span><span>{latestPayment ? String(latestPayment.status) : "—"}</span></div>
      </div>
    </div>
  );
}
