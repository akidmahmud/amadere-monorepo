import { useEffect } from "react";
import { formatMoney } from "@amader/ui";
import { ManualPaymentSubmission } from "@/components/ManualPaymentSubmission";
import { fireClientPurchase, pushEcommerceEvent } from "@/lib/analytics-events";
import { toDisplayImageUrl } from "@/lib/media";
import type { components } from "@/lib/api/schema";

type OrderDto = components["schemas"]["OrderDto"];

const MANUAL_PROVIDERS = ["BKASH", "NAGAD", "ROCKET", "UPAY"];

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  COMPLETED: "Completed",
  CANCELED: "Canceled",
  PARTIALLY_RETURNED: "Partially Returned",
  RETURNED: "Returned",
};

const SHIPMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending Pickup",
  DISPATCHED: "Dispatched",
  IN_TRANSIT: "In Transit",
  DELIVERED: "Delivered",
  PARTIALLY_DELIVERED: "Partially Delivered",
  RETURNED: "Returned",
  CANCELED: "Canceled",
  FAILED: "Failed",
};

const COURIER_LABEL: Record<string, string> = {
  STEADFAST: "Steadfast",
  PATHAO: "Pathao",
  REDX: "RedX",
  ECOURIER: "eCourier",
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  COD: "Cash on delivery (COD)",
  BKASH: "bKash",
  NAGAD: "Nagad",
  ROCKET: "Rocket",
  UPAY: "Upay",
  SSLCOMMERZ: "Card / Online Payment",
  BANK_TRANSFER: "Bank Transfer",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  AUTHORIZED: "Authorized",
  CAPTURED: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially Refunded",
};

// Labeled key/value row — used by the Order Information and Shipping
// Address cards so every field reads as "Label: value" (matched to what
// customers expect from the reference tracking page), at the same
// larger-than-default text size the rest of this component uses.
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 font-body text-[21px] text-ink">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function OrderConfirmation({ order }: { order: OrderDto }) {
  const shipping = order.addresses.find((a) => (a.type as unknown as string) === "SHIPPING");
  const latestPayment = order.payments[order.payments.length - 1];

  // Fires once per mount (this component only mounts when a fresh order was
  // just placed — a page refresh loses the parent's `placedOrder` state
  // entirely rather than re-rendering this, so there's no double-fire risk).
  useEffect(() => {
    fireClientPurchase({
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      currency: order.currency,
      items: order.items.map((item) => ({ name: item.name, price: Number(item.unitPrice), quantity: item.quantity })),
    });
    // Additive GA4-via-GTM push — fireClientPurchase above (direct
    // gtag/fbq/ttq calls) keeps working exactly as before; this is the
    // separate dataLayer mechanism any GTM container (PixelFly's included)
    // can build its own GA4/Ads/Meta tags from.
    pushEcommerceEvent("purchase", {
      transaction_id: order.orderNumber,
      value: Number(order.totalAmount),
      tax: Number(order.taxAmount),
      shipping: Number(order.shippingAmount),
      currency: order.currency,
      coupon: order.couponCode ?? undefined,
      items: order.items.map((item) => ({
        // Bare product id, same convention as every other event — see
        // productToGa4Item's comment in analytics-events.ts.
        item_id: String(item.productId ?? item.id),
        item_name: item.name,
        price: Number(item.unitPrice),
        quantity: item.quantity,
      })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  const statusPill = (label: string) => (
    <span className="rounded-full bg-beige px-4 py-1.5 font-ui text-lg font-semibold text-ink">{label}</span>
  );

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full bg-green text-white">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className="h-8 w-8">
            <path d="m5 12 5 5 9-11" />
          </svg>
        </div>
        <h1 className="font-serif text-4xl font-semibold text-ink">Order Placed!</h1>
        <p className="font-body text-lg text-muted">Thank you — we&apos;ve received your order.</p>
      </div>

      <div className="mb-5 rounded-brand border border-line bg-white p-6">
        <h3 className="mb-3 font-ui text-[21px] font-semibold text-ink">Order Information</h3>
        <div className="space-y-2">
          <InfoRow label="Order number:" value={order.orderNumber} />
          <InfoRow label="Time:" value={new Date(order.createdAt).toLocaleString()} />
          <InfoRow label="Order status:" value={statusPill(STATUS_LABEL[order.status as unknown as string] ?? order.status)} />
          {latestPayment && (
            <>
              <InfoRow
                label="Payment method:"
                value={PAYMENT_METHOD_LABEL[latestPayment.provider as unknown as string] ?? (latestPayment.provider as unknown as string)}
              />
              <InfoRow
                label="Payment status:"
                value={PAYMENT_STATUS_LABEL[latestPayment.status as unknown as string] ?? (latestPayment.status as unknown as string)}
              />
            </>
          )}
        </div>
      </div>

      {latestPayment &&
        MANUAL_PROVIDERS.includes(latestPayment.provider as unknown as string) &&
        (latestPayment.status as unknown as string) === "PENDING" && (
          <ManualPaymentSubmission orderId={order.id} provider={latestPayment.provider as unknown as string} amount={order.totalAmount} />
        )}

      <div className="mb-5 rounded-brand border border-line bg-white p-6">
        <h3 className="mb-3 font-ui text-[21px] font-semibold text-ink">Products</h3>
        <div className="space-y-4 border-b border-line pb-4">
          {order.items.map((item) => {
            const imageUrl = toDisplayImageUrl(item.imageUrl);
            return (
              <div key={item.id} className="flex items-center gap-4">
                <div className="h-14 w-14 flex-none overflow-hidden rounded bg-beige">
                  {imageUrl && <img src={imageUrl} alt={item.name} loading="lazy" className="h-full w-full object-cover" />}
                </div>
                <div className="flex flex-1 flex-wrap items-center justify-between gap-x-3 font-body text-[21px] text-ink">
                  <span>
                    {item.name} × {item.quantity}
                    {item.weight && <span className="text-muted"> · {item.weight} kg</span>}
                  </span>
                  <span>{formatMoney(String(Number(item.unitPrice) * item.quantity))}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-2 py-4">
          <div className="flex justify-between font-body text-[21px] text-muted">
            <span>Subtotal</span>
            <span>{formatMoney(order.subTotal)}</span>
          </div>
          {Number(order.discountAmount) > 0 && (
            <div className="flex justify-between font-body text-[21px] text-green">
              <span>Discount</span>
              <span>-{formatMoney(order.discountAmount)}</span>
            </div>
          )}
          {Number(order.taxAmount) > 0 && (
            <div className="flex justify-between font-body text-[21px] text-muted">
              <span>Tax</span>
              <span>{formatMoney(order.taxAmount)}</span>
            </div>
          )}
          {Number(order.codFee) > 0 && (
            <div className="flex justify-between font-body text-[21px] text-muted">
              <span>COD Fee</span>
              <span>{formatMoney(order.codFee)}</span>
            </div>
          )}
          <div className="flex justify-between font-body text-[21px] text-muted">
            <span>Shipping</span>
            <span>{formatMoney(order.shippingAmount)}</span>
          </div>
          <div className="flex justify-between font-ui text-[21px] font-semibold text-ink">
            <span>Total</span>
            <span className="font-serif text-green">{formatMoney(order.totalAmount)}</span>
          </div>
        </div>
      </div>

      {order.shipment && (
        <div className="mb-5 rounded-brand border border-line bg-white p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-ui text-[21px] font-semibold text-ink">
              Delivery Status — {COURIER_LABEL[order.shipment.provider as unknown as string] ?? order.shipment.provider}
            </h3>
            {statusPill(SHIPMENT_STATUS_LABEL[order.shipment.status as unknown as string] ?? order.shipment.status)}
          </div>
          {order.shipment.trackingCode && (
            <p className="mb-2 font-body text-lg text-muted">
              Tracking code: {order.shipment.trackingCode}
              {order.shipment.trackingUrl && (
                <>
                  {" — "}
                  <a href={order.shipment.trackingUrl} target="_blank" rel="noreferrer" className="text-green underline">
                    Track on {COURIER_LABEL[order.shipment.provider as unknown as string] ?? order.shipment.provider}
                  </a>
                </>
              )}
            </p>
          )}
          {order.shipment.events.length > 0 && (
            <ul className="space-y-2 border-t border-line pt-3">
              {order.shipment.events.map((event, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-x-3 font-body text-lg text-muted">
                  <span>{SHIPMENT_STATUS_LABEL[event.status as unknown as string] ?? event.status}</span>
                  <span>{new Date(event.occurredAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {shipping && (
        <div className="mb-5 rounded-brand border border-line bg-white p-6">
          <h3 className="mb-3 font-ui text-[21px] font-semibold text-ink">Shipping Address</h3>
          <div className="space-y-2">
            <InfoRow label="Full Name:" value={shipping.recipientName} />
            <InfoRow label="Phone:" value={shipping.phone} />
            <InfoRow
              label="Address:"
              value={[shipping.addressLine, shipping.area, shipping.district, shipping.division].filter(Boolean).join(", ")}
            />
          </div>
        </div>
      )}
    </div>
  );
}
