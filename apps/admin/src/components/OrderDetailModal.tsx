"use client";

import { useState } from "react";
import { Button, Modal, RiskBadge } from "@amader/admin-ui";
import { ORDER_STATUSES, useOrder, useRefundOrder, useUpdateOrderStatus, type OrderStatus } from "@/hooks/useOrders";
import { useAdvancePayment, useManualPaymentsForOrder } from "@/hooks/usePayments";
import { useOrderStatusConfigs } from "@/hooks/useOrderStatuses";
import { useTrackShipment } from "@/hooks/useShipments";
import type { OrderManagerRow } from "@/hooks/useOrderManager";
import { ConsignModal } from "./ConsignModal";
import { FraudDetailModal } from "./FraudDetailModal";

// Order Manager's detail view — reuses the base order-detail page's own
// hooks/endpoints (useOrder/useUpdateOrderStatus/useRefundOrder) rather than
// duplicating that logic, plus Net Profit's advance/manual payment and
// courier data that the base order page doesn't show.
export function OrderDetailModal({ row, onClose }: { row: OrderManagerRow; onClose: () => void }) {
  const { data: order, isLoading } = useOrder(row.id);
  const { data: statusConfigs } = useOrderStatusConfigs();
  const { data: advance } = useAdvancePayment(row.id);
  const { data: manual } = useManualPaymentsForOrder(row.id);
  const updateStatus = useUpdateOrderStatus(row.id);
  const refund = useRefundOrder(row.id);
  const track = useTrackShipment();
  const statusByKey = new Map((statusConfigs ?? []).map((s) => [s.status, s]));

  const [nextStatus, setNextStatus] = useState<OrderStatus>(row.status as OrderStatus);
  const [statusNote, setStatusNote] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [showConsign, setShowConsign] = useState(false);
  const [showRisk, setShowRisk] = useState(false);

  return (
    <Modal open onClose={onClose} title={`Order #${row.orderNumber}`} tone="dark" className="max-w-3xl">
      {isLoading || !order ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {row.shippingPhone && (
                <button type="button" onClick={() => setShowRisk(true)}>
                  <RiskBadge level={row.riskLevel} />
                </button>
              )}
              <span
                className="rounded-pill px-2.5 py-1 text-xs font-semibold"
                style={{ backgroundColor: `${statusByKey.get(order.status)?.color ?? "#9ca3af"}1a`, color: statusByKey.get(order.status)?.color ?? "#9ca3af" }}
              >
                {statusByKey.get(order.status)?.labelEn ?? order.status}
              </span>
            </div>
            <div className="num text-lg font-bold text-text">{order.currency} {order.totalAmount}</div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-secondary">Items</p>
            <div className="flex flex-col gap-1.5">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm text-text">
                  <span>{item.name} {item.sku && <span className="text-muted">({item.sku})</span>} × {item.quantity}</span>
                  <span className="num">{order.currency} {item.unitPrice}</span>
                </div>
              ))}
            </div>
          </div>

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

          <div>
            <p className="mb-1.5 text-xs font-semibold text-secondary">Payments</p>
            <div className="flex flex-col gap-1.5 text-sm text-text">
              {order.payments.map((p, i) => (
                <div key={i} className="flex justify-between">
                  <span>{String(p.provider)} — {String(p.status)}</span>
                  <span className="num">{order.currency} {p.amount}</span>
                </div>
              ))}
              {advance && (
                <div className="flex justify-between">
                  <span>Advance ({advance.status})</span>
                  <span className="num">৳{advance.paid} / {advance.required}</span>
                </div>
              )}
              {manual?.items.map((m) => (
                <div key={m.id} className="flex justify-between">
                  <span>Manual {m.method} — {m.trxId} ({m.status})</span>
                  <span className="num">৳{m.amount}</span>
                </div>
              ))}
              {!order.payments.length && !advance && !manual?.items.length && (
                <p className="text-muted">No payment records.</p>
              )}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-secondary">Courier</p>
            <div className="flex items-center gap-2 text-sm text-text">
              {row.courierProvider ? (
                <>
                  <span>{row.courierProvider} — {row.courierStatus ?? "—"}</span>
                  {row.shipmentId && (
                    <Button type="button" variant="ghost" disabled={track.isPending} onClick={() => row.shipmentId && track.mutate(row.shipmentId)}>
                      Refresh
                    </Button>
                  )}
                </>
              ) : (
                <Button type="button" variant="ghost" onClick={() => setShowConsign(true)}>Send to courier</Button>
              )}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="mb-1.5 text-xs font-semibold text-secondary">Status history</p>
            <div className="mb-3 flex flex-col gap-1 text-sm text-text">
              {order.statusHistory.map((h, i) => (
                <div key={i} className="flex justify-between">
                  <span>{statusByKey.get(String(h.status))?.labelEn ?? String(h.status)}{h.note && ` — ${h.note}`}</span>
                  <span className="text-xs text-muted">{new Date(h.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">New status</span>
                <select
                  value={nextStatus}
                  onChange={(e) => setNextStatus(e.target.value as OrderStatus)}
                  className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                >
                  {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>{statusByKey.get(s)?.labelEn ?? s}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">Note (optional)</span>
                <input
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  className="h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
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
          </div>

          <div className="border-t border-border pt-4">
            <p className="mb-1.5 text-xs font-semibold text-secondary">Refund</p>
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
                  className="h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
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
          </div>
        </div>
      )}

      {showConsign && <ConsignModal order={row} onClose={() => setShowConsign(false)} />}
      {showRisk && row.shippingPhone && <FraudDetailModal phone={row.shippingPhone} onClose={() => setShowRisk(false)} />}
    </Modal>
  );
}
