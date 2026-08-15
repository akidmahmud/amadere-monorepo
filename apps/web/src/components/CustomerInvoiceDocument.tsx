"use client";

import { formatMoney } from "@amader/ui";
import { toDisplayImageUrl } from "@/lib/media";
import type { components } from "@/lib/api/schema";

type OrderDto = components["schemas"]["OrderDto"];

const GREEN = "#1F703C";
const GREEN_TINT = "#EAF3EC";

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  COD: "Cash on Delivery (COD)",
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

// Simpler, storefront-only counterpart to apps/admin's InvoiceDocument —
// deliberately doesn't pull in Settings > Invoice Template/Invoice Settings
// (admin-authenticated, custom HTML templates, stamp image, custom font):
// those are business/back-office print customization, not needed for a
// customer's own self-service "download my invoice." Company branding here
// is just the public site name/logo (useSiteInfo), and layout is fixed
// rather than admin-configurable. Same "browser print / Save as PDF" story
// as the admin page — no PDF library exists in this codebase.
export function CustomerInvoiceDocument({
  order,
  siteName,
  logoUrl,
}: {
  order: OrderDto;
  siteName: string;
  logoUrl?: string | null;
}) {
  const billing = order.addresses.find((a) => (a.type as unknown as string) === "BILLING")
    ?? order.addresses.find((a) => (a.type as unknown as string) === "SHIPPING");
  const latestPayment = order.payments[order.payments.length - 1];
  const paymentProvider = latestPayment ? (latestPayment.provider as unknown as string) : null;
  const paymentStatus = latestPayment ? (latestPayment.status as unknown as string) : null;

  const paidAmount = order.payments.reduce((sum, p) => {
    if ((p.status as unknown as string) !== "CAPTURED") return sum;
    return sum + Number(p.amount) - Number(p.refundedAmount ?? 0);
  }, 0);
  const dueAmount = Math.max(0, Number(order.totalAmount) - paidAmount);

  return (
    <div className="bg-[#f5f6fa] p-10 text-sm text-[#666] print:bg-white print:p-0">
      {/* Same reasoning as admin's InvoiceDocument — browsers drop
          background-color/box-shadow when printing unless forced. */}
      <style>{`@media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }`}</style>
      <div className="mx-auto max-w-[900px] rounded-[10px] bg-white p-[50px] print:rounded-none print:p-0 print:shadow-none">
        <div className="mb-5 flex items-center justify-between">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={siteName} className="h-[50px] object-contain" />
          ) : (
            <div className="rounded-md px-4 py-2 text-xl font-bold text-white" style={{ backgroundColor: GREEN }}>
              {siteName}
            </div>
          )}
          <div className="text-[30px] font-bold uppercase text-[#111]">Invoice</div>
        </div>

        <div className="mb-5 flex items-center">
          <div className="mr-5 h-[3px] flex-1 rounded-full" style={{ backgroundColor: GREEN }} />
          <div className="flex gap-5 whitespace-nowrap text-[#111]">
            <p className="m-0">
              Order No: <strong style={{ color: GREEN }}>{order.orderNumber}</strong>
            </p>
            <p className="m-0">
              Date: <strong style={{ color: GREEN }}>{new Date(order.createdAt).toLocaleDateString()}</strong>
            </p>
          </div>
        </div>

        {billing && (
          <div className="mb-5">
            <p className="mb-1 font-bold" style={{ color: GREEN }}>Billed To:</p>
            <p className="m-0">{billing.recipientName}</p>
            <p className="m-0">{billing.addressLine}</p>
            <p className="m-0">{[billing.area, billing.district, billing.division, billing.postCode].filter(Boolean).join(", ")}</p>
            <p className="m-0">{billing.phone}</p>
          </div>
        )}

        <div className="mb-5 overflow-hidden rounded-md border border-[#dbdfea]">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr style={{ backgroundColor: GREEN_TINT }}>
                <th className="px-4 py-2.5 text-[#111]">Item</th>
                <th className="px-4 py-2.5 text-[#111]">Price</th>
                <th className="px-4 py-2.5 text-[#111]">Qty</th>
                <th className="px-4 py-2.5 text-right text-[#111]">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => {
                const imageUrl = toDisplayImageUrl(item.imageUrl);
                return (
                  <tr key={item.id} className="border-b border-[#dbdfea]">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={imageUrl} alt="" className="h-9 w-9 shrink-0 rounded object-cover print:hidden" />
                        )}
                        <span>
                          {item.name} {item.sku && <span className="text-[#b5b5b5]">({item.sku})</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">{formatMoney(item.unitPrice)}</td>
                    <td className="px-4 py-2.5">{item.quantity}</td>
                    <td className="px-4 py-2.5 text-right">{formatMoney(String(Number(item.unitPrice) * item.quantity))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-start justify-between gap-5">
          <div className="flex w-[48%] flex-col gap-2.5 rounded-md border border-[#dbdfea] px-5 py-4">
            <p className="m-0 font-bold" style={{ color: GREEN }}>Payment Information</p>
            <div className="flex items-center justify-between text-[#111]">
              <span className="font-semibold">Payment Method</span>
              <span>{paymentProvider ? PAYMENT_METHOD_LABEL[paymentProvider] ?? paymentProvider : "—"}</span>
            </div>
            <div className="flex items-center justify-between text-[#111]">
              <span className="font-semibold">Payment Status</span>
              <span>{paymentStatus ? PAYMENT_STATUS_LABEL[paymentStatus] ?? paymentStatus : "—"}</span>
            </div>
            <div className="flex justify-between font-bold" style={{ color: dueAmount > 0 ? "#c53030" : GREEN }}>
              <span>Due Amount</span>
              <span>{formatMoney(String(dueAmount))}</span>
            </div>
            {paymentProvider === "COD" && dueAmount > 0 && (
              <p className="m-0 rounded-md bg-[#fdf3d9] px-3 py-2 text-xs text-[#a9740a]">
                Please pay the delivery person the due amount.
              </p>
            )}
          </div>
          <div className="flex w-[48%] flex-col gap-1 text-[#111]">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(order.subTotal)}</span></div>
            {Number(order.discountAmount) > 0 && (
              <div className="flex justify-between" style={{ color: GREEN }}>
                <span>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</span>
                <span>-{formatMoney(order.discountAmount)}</span>
              </div>
            )}
            {Number(order.shippingAmount) > 0 && (
              <div className="flex justify-between"><span>Shipping</span><span>{formatMoney(order.shippingAmount)}</span></div>
            )}
            {Number(order.taxAmount) > 0 && (
              <div className="flex justify-between"><span>Tax</span><span>{formatMoney(order.taxAmount)}</span></div>
            )}
            {Number(order.codFee) > 0 && (
              <div className="flex justify-between"><span>COD Fee</span><span>{formatMoney(order.codFee)}</span></div>
            )}
            <div className="mt-1 flex justify-between border-t border-dashed border-[#c7ccd6] pt-2.5 text-base font-bold">
              <span className="text-[#111]">Grand Total</span>
              <span style={{ color: GREEN }}>{formatMoney(order.totalAmount)}</span>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-md py-3 text-center text-sm font-semibold text-white" style={{ backgroundColor: GREEN }}>
          Thank you for shopping with {siteName}!
        </div>
      </div>
    </div>
  );
}
