"use client";

import { use, useState } from "react";
import { Button, Card } from "@amader/admin-ui";
import { ORDER_STATUSES, useOrder, useRefundOrder, useUpdateOrderStatus, type OrderStatus } from "@/hooks/useOrders";
import { SHIPMENT_PROVIDERS, useDispatchShipment, type ShipmentProvider } from "@/hooks/useShipments";

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const orderId = Number(id);
  const { data: order, isLoading } = useOrder(orderId);
  const updateStatus = useUpdateOrderStatus(orderId);
  const refund = useRefundOrder(orderId);
  const dispatch = useDispatchShipment();

  const [nextStatus, setNextStatus] = useState<OrderStatus>("PROCESSING");
  const [statusNote, setStatusNote] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [provider, setProvider] = useState<ShipmentProvider>("STEADFAST");

  if (isLoading || !order) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-ui text-base font-semibold text-text">#{order.orderNumber}</h3>
            <p className="text-xs text-muted">{new Date(order.createdAt).toLocaleString()}</p>
          </div>
          <div className="text-right">
            <div className="num text-lg font-bold text-text">
              {order.currency} {order.totalAmount}
            </div>
            <div className="text-xs text-muted">{order.status}</div>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 font-ui text-base font-semibold text-text">Items</h3>
        <div className="flex flex-col gap-2">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-sm">
              <span className="text-text">
                {item.name} {item.sku && <span className="text-muted">({item.sku})</span>} × {item.quantity}
              </span>
              <span className="num text-text">{order.currency} {item.unitPrice}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3 text-sm">
          <div className="flex justify-between text-secondary"><span>Subtotal</span><span className="num">{order.subTotal}</span></div>
          <div className="flex justify-between text-secondary"><span>Discount</span><span className="num">-{order.discountAmount}</span></div>
          <div className="flex justify-between text-secondary"><span>Tax</span><span className="num">{order.taxAmount}</span></div>
          <div className="flex justify-between text-secondary"><span>Shipping</span><span className="num">{order.shippingAmount}</span></div>
          <div className="flex justify-between font-semibold text-text"><span>Total</span><span className="num">{order.totalAmount}</span></div>
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 font-ui text-base font-semibold text-text">Addresses</h3>
        <div className="grid grid-cols-2 gap-4">
          {order.addresses.map((addr, i) => (
            <div key={i} className="text-sm text-text">
              <div className="font-semibold">{addr.recipientName}</div>
              <div className="text-muted">{addr.phone}</div>
              <div>{addr.addressLine}</div>
              <div>{addr.area}, {addr.district}, {addr.division}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 font-ui text-base font-semibold text-text">Status history</h3>
        <div className="flex flex-col gap-1.5 text-sm">
          {order.statusHistory.map((h, i) => (
            <div key={i} className="flex justify-between text-text">
              <span>{String(h.status)}{h.note && ` — ${h.note}`}</span>
              <span className="text-xs text-muted">{new Date(h.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">New status</span>
            <select
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value as OrderStatus)}
              className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Note (optional)</span>
            <input
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            />
          </label>
          <Button
            type="button"
            variant="primary"
            disabled={updateStatus.isPending}
            onClick={() => updateStatus.mutate({ status: nextStatus, note: statusNote || undefined })}
          >
            {updateStatus.isPending ? "Updating…" : "Update status"}
          </Button>
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 font-ui text-base font-semibold text-text">Refund</h3>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Amount</span>
            <input
              type="number"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              className="num h-10 w-32 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Reason (optional)</span>
            <input
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            />
          </label>
          <Button
            type="button"
            variant="ghost"
            disabled={refund.isPending || !refundAmount}
            onClick={() => refund.mutate({ amount: Number(refundAmount), reason: refundReason || undefined })}
          >
            {refund.isPending ? "Processing…" : "Issue refund"}
          </Button>
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 font-ui text-base font-semibold text-text">Shipment</h3>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Courier</span>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as ShipmentProvider)}
              className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            >
              {SHIPMENT_PROVIDERS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant="primary"
            disabled={dispatch.isPending}
            onClick={() => dispatch.mutate({ orderId, provider })}
          >
            {dispatch.isPending ? "Dispatching…" : "Dispatch shipment"}
          </Button>
        </div>
        {dispatch.isSuccess && (
          <p className="mt-2 text-xs text-success">
            Dispatched — tracking code {dispatch.data.trackingCode ?? "pending"}.
          </p>
        )}
        {dispatch.isError && <p className="mt-2 text-xs text-danger">{(dispatch.error as Error).message}</p>}
      </Card>
    </div>
  );
}
