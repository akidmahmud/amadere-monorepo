import { formatMoney } from "@amader/ui";
import type { components } from "@/lib/api/schema";

type OrderDto = components["schemas"]["OrderDto"];

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  COMPLETED: "Completed",
  CANCELED: "Canceled",
  PARTIALLY_RETURNED: "Partially Returned",
  RETURNED: "Returned",
};

export function OrderConfirmation({ order }: { order: OrderDto }) {
  const shipping = order.addresses.find((a) => (a.type as unknown as string) === "SHIPPING");
  const latestPayment = order.payments[order.payments.length - 1];

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-green text-white">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className="h-7 w-7">
            <path d="m5 12 5 5 9-11" />
          </svg>
        </div>
        <h1 className="font-serif text-2xl font-semibold text-ink">Order Placed!</h1>
        <p className="font-body text-sm text-muted">Thank you — we&apos;ve received your order.</p>
      </div>

      <div className="mb-4 rounded-brand border border-line bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-ui text-sm font-semibold text-ink">{order.orderNumber}</span>
          <span className="rounded-full bg-beige px-3 py-1 font-ui text-xs font-semibold text-ink">
            {STATUS_LABEL[order.status as unknown as string] ?? order.status}
          </span>
        </div>

        <div className="space-y-2 border-b border-line pb-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between font-body text-sm text-ink">
              <span>
                {item.name} × {item.quantity}
              </span>
              <span>{formatMoney(String(Number(item.unitPrice) * item.quantity))}</span>
            </div>
          ))}
        </div>

        <div className="space-y-1.5 py-3">
          <div className="flex justify-between font-body text-sm text-muted">
            <span>Subtotal</span>
            <span>{formatMoney(order.subTotal)}</span>
          </div>
          {Number(order.discountAmount) > 0 && (
            <div className="flex justify-between font-body text-sm text-green">
              <span>Discount</span>
              <span>-{formatMoney(order.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-body text-sm text-muted">
            <span>Shipping</span>
            <span>{formatMoney(order.shippingAmount)}</span>
          </div>
          <div className="flex justify-between font-ui font-semibold text-ink">
            <span>Total</span>
            <span className="font-serif text-green">{formatMoney(order.totalAmount)}</span>
          </div>
        </div>

        {latestPayment && (
          <p className="border-t border-line pt-3 font-body text-xs text-muted">
            Payment: {latestPayment.provider as unknown as string} — {latestPayment.status as unknown as string}
          </p>
        )}
      </div>

      {shipping && (
        <div className="mb-4 rounded-brand border border-line bg-white p-5">
          <h3 className="mb-2 font-ui text-sm font-semibold text-ink">Shipping to</h3>
          <p className="font-body text-sm text-muted">
            {shipping.recipientName}, {shipping.phone}
            <br />
            {shipping.addressLine}
            {shipping.area ? `, ${shipping.area}` : ""}, {shipping.district}, {shipping.division}
          </p>
        </div>
      )}
    </div>
  );
}
