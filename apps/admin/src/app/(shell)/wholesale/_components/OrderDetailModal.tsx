"use client";

import { Modal } from "@amader/admin-ui";
import {
  COURIERS,
  ORDER_CHANNELS,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  labelOf,
  type WholesaleOrder,
} from "@/hooks/useWholesale";
import { Thumb } from "./Thumb";

const money = (v: string | number) =>
  `৳${Number(v || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function Item({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface-2 p-3 ${
        wide ? "sm:col-span-2 lg:col-span-4" : ""
      }`}
    >
      <span className="block text-[9px] font-bold uppercase tracking-wide text-muted">
        {label}
      </span>
      <strong className="mt-1 block break-words text-[11px] text-text">
        {value || "N/A"}
      </strong>
    </div>
  );
}

export function OrderDetailModal({
  order,
  onClose,
}: {
  order: WholesaleOrder;
  onClose: () => void;
}) {
  const d = order.delivery;
  const wholesale = order.type === "WHOLESALE";
  const address = [d.addressLine, d.district, d.thana, d.landmark, d.postCode]
    .filter(Boolean)
    .join(" · ");

  return (
    <Modal
      open
      onClose={onClose}
      title={`Order ${order.orderNumber}`}
      className="max-w-4xl"
    >
      <div className="space-y-5 p-1">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <Item label="Order ID" value={order.orderNumber} />
          <Item label="Order type" value={wholesale ? "Wholesale" : "Cash Sale"} />
          <Item label="Customer" value={order.customerName} />
          <Item label="Customer phone" value={order.customerPhone ?? ""} />
          <Item label="Channel" value={labelOf(ORDER_CHANNELS, order.channel)} />
          <Item
            label="Payment method"
            value={labelOf(PAYMENT_METHODS, order.paymentMethod)}
          />
          <Item label="Transaction ID" value={order.transactionId ?? ""} />
          <Item label="GP number" value={order.gpNumber ?? ""} />
          <Item
            label="Payment status"
            value={labelOf(PAYMENT_STATUSES, order.paymentStatus)}
          />
          <Item label="Courier" value={labelOf(COURIERS, order.courier)} />
          <Item label="Consignment ID" value={order.consignmentId ?? ""} />
          <Item label="Invoice" value={order.invoiceDocNo ?? ""} />
          {/* Shown for a cash sale too — only the courier above is
              wholesale-only, and a counter sale still went to someone. */}
          <Item label="Recipient" value={d.recipientName ?? ""} />
          <Item label="Recipient phone" value={d.recipientPhone ?? ""} />
          <Item label="Alternative phone" value={d.alternativePhone ?? ""} />
          <Item label="Email" value={d.recipientEmail ?? ""} />
          <Item label="Delivery address" value={address} wide />
          {order.note && <Item label="Note" value={order.note} wide />}
        </div>

        <div>
          <h4 className="mb-2.5 text-xs font-bold text-text">
            Products & price
          </h4>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className="bg-surface-2 text-[9px] uppercase tracking-wide text-muted">
                  <th className="px-3 py-2.5 text-left font-bold">Product</th>
                  <th className="px-3 py-2.5 text-left font-bold">Qty</th>
                  <th className="px-3 py-2.5 text-left font-bold">Unit price</th>
                  <th className="px-3 py-2.5 text-left font-bold">Discount</th>
                  <th className="px-3 py-2.5 text-right font-bold">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((i) => (
                  <tr key={i.id} className="border-t border-border text-[11px]">
                    <td className="px-3 py-2.5 text-text">
                      <span className="flex items-center gap-2.5">
                        <Thumb url={i.imageUrl} name={i.name} size={32} />
                        <span className="min-w-0">
                          {i.name}
                          {i.sku && (
                            <span className="block text-[10px] text-muted">
                              SKU {i.sku}
                            </span>
                          )}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-secondary">{i.quantity}</td>
                    <td className="px-3 py-2.5 text-secondary">
                      {money(i.unitPrice)}
                    </td>
                    <td className="px-3 py-2.5 text-secondary">
                      {money(i.discount)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-text">
                      {money(i.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-border bg-surface-2 p-3.5 text-xs">
          <div className="flex justify-between">
            <span className="text-secondary">Subtotal</span>
            <strong className="text-text">{money(order.subtotal)}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary">Order discount</span>
            <strong className="text-text">{money(order.discount)}</strong>
          </div>
          {wholesale && (
            <div className="flex justify-between">
              <span className="text-secondary">Delivery charge</span>
              <strong className="text-text">{money(order.deliveryCharge)}</strong>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-2.5">
            <span className="text-sm text-secondary">Grand total</span>
            <strong className="text-base font-black text-brand-600 dark:text-brand-400">
              {money(order.total)}
            </strong>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-secondary">Collected</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {money(order.paid)}
            </span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-secondary">Outstanding</span>
            <span
              className={`font-bold ${
                Number(order.due) > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-secondary"
              }`}
            >
              {money(order.due)}
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
