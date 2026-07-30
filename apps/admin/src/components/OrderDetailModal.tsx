"use client";

import { useState } from "react";
import Link from "next/link";
import { BD_DIVISIONS } from "@amader/shared";
import { Button, Icon, Modal } from "@amader/admin-ui";
import {
  ORDER_CHANNELS,
  PAYMENT_PROVIDER_TYPES,
  useAddOrderItem,
  useOrder,
  useReorderOrder,
  useResendOrderConfirmation,
  useRefundOrder,
  useRemoveOrderItem,
  useUpdateOrderAmounts,
  useUpdateOrderDetails,
  useUpdateOrderItem,
  useUpdateOrderPayment,
  useUpdateOrderStatus,
  type ManualOrderPaymentStatus,
  type OrderChannel,
  type PaymentProviderType,
} from "@/hooks/useOrders";
import { useUpdateOrderNote } from "@/hooks/useOrderManager";
import { useAdvancePayment, useManualPaymentsForOrder } from "@/hooks/usePayments";
import { useOrderStatusConfigs } from "@/hooks/useOrderStatuses";
import { useProductSearch } from "@/hooks/useProducts";
import { useCancelShipment, useTrackShipment, useUpdateShipmentStatus, SHIPMENT_STATUSES, type ShipmentStatus } from "@/hooks/useShipments";
import type { OrderManagerRow } from "@/hooks/useOrderManager";
import { ProxyApiError } from "@/lib/api/proxy-client";
import { ConsignModal } from "./ConsignModal";
import { FraudDetailModal } from "./FraudDetailModal";

const PAYMENT_STATUSES: ManualOrderPaymentStatus[] = ["PENDING", "AUTHORIZED", "CAPTURED", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"];
const GREEN = "#1e7439";
const AMBER = "#f59f00";
const BLUE = "#4299e1";
const RED = "#d63939";
const LINE = "#e5e7eb";

function ProductThumb({ url }: { url?: string }) {
  if (!url) {
    return <div className="grid h-11 w-11 flex-none place-items-center rounded-sm border border-border bg-surface-2 text-sm">📦</div>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="h-11 w-11 flex-none rounded-sm border border-border object-cover" />;
}

// Matches the reference's solid pill badges — same shape wherever a status
// is shown (order/payment/shipment), colored per the real semantic status
// rather than always amber like the reference (which happens to show every
// status here as "pending"-equivalent).
function StatusPill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="rounded-[6px] px-2 py-[3px] text-xs font-medium text-white" style={{ backgroundColor: color }}>
      {children}
    </span>
  );
}

function PencilButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex" style={{ color: GREEN }} aria-label="Edit">
      <Icon name="edit" size={16} />
    </button>
  );
}

function TimelineDot({ active }: { active: boolean }) {
  return <span className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: active ? GREEN : LINE }} />;
}

const outlineBtn = "inline-flex h-9 items-center gap-1.5 rounded-sm border border-border bg-surface px-3 text-sm font-medium text-text hover:bg-surface-2";

export function OrderDetailModal({ row, onClose }: { row: OrderManagerRow; onClose: () => void }) {
  const { data: order, isLoading } = useOrder(row.id);
  const { data: statusConfigs } = useOrderStatusConfigs();
  const { data: advance } = useAdvancePayment(row.id);
  const { data: manual } = useManualPaymentsForOrder(row.id);
  const updateStatus = useUpdateOrderStatus(row.id);
  const refund = useRefundOrder(row.id);
  const track = useTrackShipment();
  const cancelShipment = useCancelShipment();
  const updateShipmentStatus = useUpdateShipmentStatus();
  const addItem = useAddOrderItem(row.id);
  const updateItem = useUpdateOrderItem(row.id);
  const removeItem = useRemoveOrderItem(row.id);
  const updateDetails = useUpdateOrderDetails(row.id);
  const updatePayment = useUpdateOrderPayment(row.id);
  const updateAmounts = useUpdateOrderAmounts(row.id);
  const updateNote = useUpdateOrderNote(row.id);
  const resendConfirmation = useResendOrderConfirmation(row.id);
  const reorder = useReorderOrder(row.id);
  const statusByKey = new Map((statusConfigs ?? []).map((s) => [s.status, s]));

  const [showConsign, setShowConsign] = useState(false);
  const [showRisk, setShowRisk] = useState(false);
  const [showStatusOverride, setShowStatusOverride] = useState(false);
  const [shipmentStatusDraft, setShipmentStatusDraft] = useState<ShipmentStatus>("DISPATCHED");

  const [productQuery, setProductQuery] = useState("");
  const { data: productResults } = useProductSearch(productQuery);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<number, string>>({});

  const [editingDiscount, setEditingDiscount] = useState(false);
  const [discountDraft, setDiscountDraft] = useState("");
  const [editingShipping, setEditingShipping] = useState(false);
  const [shippingDraft, setShippingDraft] = useState("");
  const [customerNoteDraft, setCustomerNoteDraft] = useState<string | null>(null);
  const [privateNoteDraft, setPrivateNoteDraft] = useState<string | null>(null);

  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");

  const shippingAddress = order?.addresses.find((a) => (a.type as unknown as string) === "SHIPPING");
  const billingAddress = order?.addresses.find((a) => (a.type as unknown as string) === "BILLING");
  const latestPayment = order?.payments[order.payments.length - 1];
  const itemsEditable = order ? ["PENDING", "CONFIRMED", "PROCESSING", "HOLD"].includes(order.status) : false;
  const totalQuantity = order?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0;
  const paidAmount = latestPayment && (latestPayment.status as unknown as string) === "CAPTURED" ? latestPayment.amount : "0.00";

  return (
    <Modal open onClose={onClose} title={order ? `Order ${order.orderNumber}` : "Order"} tone="dark" className="max-w-[1400px]">
      {isLoading || !order ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
          {/* LEFT COLUMN */}
          <div className="flex flex-col gap-5">
            {/* Order information card */}
            <div className="rounded-card border border-border bg-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-text">Order information {order.orderNumber}</h3>
                <StatusPill color={statusByKey.get(order.status)?.color ?? "#9ca3af"}>
                  {statusByKey.get(order.status)?.labelEn ?? order.status}
                </StatusPill>
              </div>

              {itemsEditable && (
                <div className="relative mb-3">
                  <input
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                    placeholder="Search or add a product..."
                    className="h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                  />
                  {productResults && productResults.length > 0 && (
                    <div className="absolute z-10 mt-1 flex w-full flex-col gap-1 rounded-sm border border-border bg-surface p-1.5 shadow-card">
                      {productResults.flatMap((p) => {
                        const thumb = p.media.find((m) => m.isPrimary) ?? p.media[0];
                        const notPublished = p.status !== "PUBLISHED";
                        return p.hasVariants
                          ? p.variants.map((v) => {
                              // stockStatus is derived from stock alone and goes stale once
                              // reservations (other pending orders) eat the remaining stock —
                              // reserveStock() always enforces stock - reservedStock for
                              // variants, so that's the only accurate availability check.
                              const outOfStock = v.stock - v.reservedStock < 1;
                              return (
                                <button
                                  key={`${p.id}-${v.id}`}
                                  type="button"
                                  disabled={addItem.isPending || outOfStock}
                                  onClick={() => {
                                    addItem.mutate({ productId: p.id, variantId: v.id, quantity: 1 });
                                    setProductQuery("");
                                  }}
                                  className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-text hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <ProductThumb url={thumb?.url} />
                                  <span>
                                    {p.translations[0]?.name ?? p.slug} — {v.sku ?? `Variant #${v.id}`} — ৳{v.salePrice ?? v.price ?? "0"}
                                    {outOfStock && <span className="ml-2 font-bold" style={{ color: RED }}>Out of stock</span>}
                                    {notPublished && <span className="ml-2 font-bold" style={{ color: RED }}>Not published</span>}
                                  </span>
                                </button>
                              );
                            })
                          : (() => {
                              // Simple (no-variant) products only enforce stock at all when
                              // trackInventory is on, and allowBackorder bypasses it entirely —
                              // same conditions reserveStock() checks.
                              const outOfStock = p.trackInventory && !p.allowBackorder && p.stock - p.reservedStock < 1;
                              return [
                                <button
                                  key={p.id}
                                  type="button"
                                  disabled={addItem.isPending || outOfStock}
                                  onClick={() => {
                                    addItem.mutate({ productId: p.id, quantity: 1 });
                                    setProductQuery("");
                                  }}
                                  className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-text hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <ProductThumb url={thumb?.url} />
                                  <span>
                                    {p.translations[0]?.name ?? p.slug} — ৳{p.salePrice ?? p.price ?? "0"} {p.sku ? `(${p.sku})` : ""}
                                    {outOfStock && <span className="ml-2 font-bold" style={{ color: RED }}>Out of stock</span>}
                                    {notPublished && <span className="ml-2 font-bold" style={{ color: RED }}>Not published</span>}
                                  </span>
                                </button>,
                              ];
                            })();
                      })}
                    </div>
                  )}
                  {addItem.error && (
                    <p className="mt-1 text-xs font-semibold" style={{ color: RED }}>
                      {addItem.error instanceof ProxyApiError ? addItem.error.message : "Failed to add product"}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 border-b border-border pb-2 text-sm text-text">
                    <ProductThumb url={undefined} />
                    <span className="flex-1">
                      {item.name} {item.sku && <span className="text-muted">(SKU: {item.sku})</span>}
                      {item.weight && <span className="text-muted"> · {item.weight} kg</span>}
                    </span>
                    <span className="num w-20 text-right text-muted">৳{item.unitPrice}</span>
                    <span className="text-muted">x</span>
                    {itemsEditable ? (
                      <input
                        type="number"
                        min={1}
                        value={quantityDrafts[item.id] ?? item.quantity}
                        onChange={(e) => setQuantityDrafts((d) => ({ ...d, [item.id]: e.target.value }))}
                        className="num h-8 w-14 rounded-sm border border-border bg-surface px-1.5 text-center text-sm text-text"
                      />
                    ) : (
                      <span className="num w-8 text-center">{item.quantity}</span>
                    )}
                    <span className="num w-20 text-right font-semibold">৳{(Number(item.unitPrice) * item.quantity).toFixed(2)}</span>
                    {itemsEditable && (
                      <div className="flex flex-col gap-1">
                        {Number(quantityDrafts[item.id] ?? item.quantity) !== item.quantity && (
                          <button
                            type="button"
                            disabled={updateItem.isPending}
                            onClick={() => {
                              const quantity = Math.max(1, Number(quantityDrafts[item.id]));
                              updateItem.mutate({ itemId: item.id, quantity });
                              setQuantityDrafts((d) => { const c = { ...d }; delete c[item.id]; return c; });
                            }}
                            className="rounded-sm border px-2 py-0.5 text-xs font-semibold"
                            style={{ borderColor: GREEN, color: GREEN }}
                          >
                            Update
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={removeItem.isPending || order.items.length <= 1}
                          onClick={() => removeItem.mutate(item.id)}
                          className="rounded-sm border px-2 py-0.5 text-xs font-semibold disabled:opacity-40"
                          style={{ borderColor: RED, color: RED }}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="mt-3 flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between"><span className="text-muted">Quantity</span><span className="num font-semibold text-text">{totalQuantity}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted">Total weight</span><span className="num font-semibold text-text">{order.totalWeight} kg</span></div>
                <div className="flex items-center justify-between"><span className="text-muted">Sub amount</span><span className="num font-semibold text-text">৳{order.subTotal}</span></div>

                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-muted">Discount</span>
                    {order.couponCode && <p className="text-xs text-muted">Coupon code: &quot;{order.couponCode}&quot;</p>}
                  </div>
                  {editingDiscount ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number" min={0} step="0.01" autoFocus value={discountDraft}
                        onChange={(e) => setDiscountDraft(e.target.value)}
                        className="num h-8 w-24 rounded-sm border border-border bg-surface px-2 text-right text-sm text-text"
                      />
                      <button type="button" className="text-xs font-semibold" style={{ color: GREEN }}
                        onClick={() => { updateAmounts.mutate({ discountAmount: Number(discountDraft) || 0 }); setEditingDiscount(false); }}>
                        Save
                      </button>
                    </div>
                  ) : (
                    <span className="num flex items-center gap-1.5 font-semibold text-text">
                      ৳{order.discountAmount}
                      <PencilButton onClick={() => { setDiscountDraft(order.discountAmount); setEditingDiscount(true); }} />
                    </span>
                  )}
                </div>

                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-muted">Shipping fee</span>
                    {order.shippingMethod && <p className="text-xs text-muted">{order.shippingMethod}</p>}
                    {order.shipment?.weight && <p className="text-xs text-muted">{order.shipment.weight} kg</p>}
                  </div>
                  {editingShipping ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number" min={0} step="0.01" autoFocus value={shippingDraft}
                        onChange={(e) => setShippingDraft(e.target.value)}
                        className="num h-8 w-24 rounded-sm border border-border bg-surface px-2 text-right text-sm text-text"
                      />
                      <button type="button" className="text-xs font-semibold" style={{ color: GREEN }}
                        onClick={() => { updateAmounts.mutate({ shippingAmount: Number(shippingDraft) || 0 }); setEditingShipping(false); }}>
                        Save
                      </button>
                    </div>
                  ) : (
                    <span className="num flex items-center gap-1.5 font-semibold text-text">
                      ৳{order.shippingAmount}
                      <PencilButton onClick={() => { setShippingDraft(order.shippingAmount); setEditingShipping(true); }} />
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span className="font-bold text-text">Total amount</span>
                  <span className="num font-bold" style={{ color: "#f97316" }}>৳{order.totalAmount}</span>
                </div>
                <div className="flex items-center justify-between"><span className="text-muted">Paid amount</span><span className="num font-semibold" style={{ color: BLUE }}>৳{paidAmount}</span></div>

                <div className="flex items-center justify-between">
                  <span className="text-muted">Payment method</span>
                  <select
                    value={(latestPayment?.provider as unknown as string) ?? ""}
                    disabled={!latestPayment || updatePayment.isPending}
                    onChange={(e) => updatePayment.mutate({ provider: e.target.value as PaymentProviderType })}
                    className="h-8 rounded-sm border-0 bg-transparent text-right text-sm font-semibold outline-none disabled:opacity-50"
                    style={{ color: BLUE }}
                  >
                    {!latestPayment && <option value="">—</option>}
                    {PAYMENT_PROVIDER_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Payment status</span>
                  <select
                    value={(latestPayment?.status as unknown as string) ?? ""}
                    disabled={!latestPayment || updatePayment.isPending}
                    onChange={(e) => updatePayment.mutate({ status: e.target.value as ManualOrderPaymentStatus })}
                    className="h-7 rounded-[6px] border-0 px-2 text-xs font-medium text-white outline-none disabled:opacity-50"
                    style={{ backgroundColor: (latestPayment?.status as unknown as string) === "CAPTURED" ? GREEN : AMBER }}
                  >
                    {!latestPayment && <option value="">—</option>}
                    {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {advance && (
                  <div className="flex items-center justify-between"><span className="text-muted">Advance ({advance.status})</span><span className="num">৳{advance.paid} / {advance.required}</span></div>
                )}
                {manual?.items.map((m) => (
                  <div key={m.id} className="flex items-center justify-between"><span className="text-muted">Manual {m.method} — {m.trxId} ({m.status})</span><span className="num">৳{m.amount}</span></div>
                ))}
              </div>

              <div className="mt-4 flex gap-2 border-t border-border pt-4">
                <a href={`/print/orders/${order.id}/invoice`} target="_blank" rel="noreferrer" className={outlineBtn}>
                  <Icon name="print" size={16} /> Print invoice
                </a>
                <a href={`/print/orders/${order.id}/invoice`} target="_blank" rel="noreferrer" className={outlineBtn}>
                  <Icon name="download" size={16} /> Download invoice
                </a>
              </div>

              <div className="mt-4 flex flex-col gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-text">Note (from customer at the checkout page)</span>
                  <textarea
                    value={customerNoteDraft ?? order.customerNote ?? ""}
                    onChange={(e) => setCustomerNoteDraft(e.target.value)}
                    placeholder="Add note..."
                    rows={2}
                    className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand-500"
                  />
                  <span className="text-xs text-muted">Note about order, ex: time or shipping instruction. This note is added by customer at the checkout page, you should not change it.</span>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-text">Private notes</span>
                  <textarea
                    value={privateNoteDraft ?? order.staffNote ?? ""}
                    onChange={(e) => setPrivateNoteDraft(e.target.value)}
                    placeholder="Add note..."
                    rows={2}
                    className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand-500"
                  />
                  <span className="text-xs text-muted">Note for admin/manager about this order. This note is added by admin/manager, customer cannot see it.</span>
                </label>
                {(customerNoteDraft !== null || privateNoteDraft !== null) && (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={updateNote.isPending}
                    onClick={() => {
                      if (privateNoteDraft !== null) updateNote.mutate(privateNoteDraft);
                      setCustomerNoteDraft(null);
                      setPrivateNoteDraft(null);
                    }}
                    className="self-start"
                  >
                    Save
                  </Button>
                )}
              </div>
            </div>

            {/* Confirmation / payment / delivery timeline card */}
            <div className="rounded-card border border-border bg-surface p-4">
              <div className="flex items-center gap-2 border-b border-border pb-3 text-sm font-semibold uppercase tracking-wide text-text">
                <Icon name="check_circle" size={18} className="text-[#1e7439]" />
                Order was confirmed
              </div>

              {latestPayment && (latestPayment.status as unknown as string) !== "CAPTURED" && (
                <div className="flex items-center justify-between border-b border-border py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-text">
                    <Icon name="credit_card" size={18} className="text-muted" />
                    Pending payment
                  </div>
                  <Button type="button" variant="primary" disabled={updatePayment.isPending}
                    onClick={() => updatePayment.mutate({ status: "CAPTURED" })}
                    style={{ backgroundColor: BLUE, borderColor: BLUE }}>
                    Confirm payment
                  </Button>
                </div>
              )}

              <div className="flex items-center gap-2 py-3 text-sm font-semibold uppercase tracking-wide text-text">
                <Icon name="check_circle" size={18} className={order.shipment ? "text-[#1e7439]" : "text-muted"} />
                Delivery
              </div>

              {order.shipment ? (
                <>
                  <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
                    <div><p className="text-xs font-semibold uppercase text-muted">Shipping</p><p className="font-semibold" style={{ color: BLUE }}>#{row.shipmentId}</p></div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted">Status</p>
                      <div className="flex items-center gap-1.5">
                        <StatusPill color={AMBER}>{String(order.shipment.status)}</StatusPill>
                        <button type="button" disabled={track.isPending} onClick={() => row.shipmentId && track.mutate(row.shipmentId)} aria-label="Refresh from courier">
                          <Icon name="refresh" size={16} className="text-muted" />
                        </button>
                      </div>
                    </div>
                    <div><p className="text-xs font-semibold uppercase text-muted">Shipping method</p><p>{order.shippingMethod ?? "—"}</p></div>
                    <div><p className="text-xs font-semibold uppercase text-muted">Weight (kg)</p><p>{order.shipment.weight ?? "—"}</p></div>
                    <div><p className="text-xs font-semibold uppercase text-muted">Last Update</p><p>{new Date(order.shipment.updatedAt).toLocaleString()}</p></div>
                    <div><p className="text-xs font-semibold uppercase text-muted">Cash on delivery amount (COD)</p><p>৳{order.shipment.codAmount ?? "0.00"}</p></div>
                  </div>

                  {showStatusOverride && (
                    <div className="mt-3 flex items-end gap-2 rounded-sm border border-border p-3">
                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-muted">New shipment status</span>
                        <select value={shipmentStatusDraft} onChange={(e) => setShipmentStatusDraft(e.target.value as ShipmentStatus)} className="h-9 rounded-sm border border-border bg-surface px-2 text-sm text-text">
                          {SHIPMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </label>
                      <Button type="button" variant="primary" disabled={updateShipmentStatus.isPending}
                        onClick={() => {
                          if (!row.shipmentId) return;
                          updateShipmentStatus.mutate({ id: row.shipmentId, status: shipmentStatusDraft });
                          setShowStatusOverride(false);
                        }}>
                        Save
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setShowStatusOverride(false)}>Cancel</Button>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" disabled={cancelShipment.isPending} className={outlineBtn}
                      onClick={() => row.shipmentId && cancelShipment.mutate({ id: row.shipmentId, reasonCode: "Canceled by staff" })}>
                      <Icon name="cancel" size={16} /> Cancel shipping
                    </button>
                    <button type="button" className={outlineBtn} onClick={() => setShowStatusOverride(true)}>
                      <Icon name="local_shipping" size={16} /> Update shipping status
                    </button>
                    <a href={`/print/orders/${order.id}/label`} target="_blank" rel="noreferrer" className={outlineBtn}>
                      <Icon name="print" size={16} /> Print shipping label
                    </a>
                  </div>
                </>
              ) : (
                <Button type="button" variant="ghost" onClick={() => setShowConsign(true)}>Send to courier</Button>
              )}
            </div>

            {/* History card */}
            <div className="rounded-card border border-border bg-surface p-4">
              <h3 className="mb-3 text-base font-semibold text-text">History</h3>
              <div className="flex flex-col gap-3">
                {[...order.statusHistory].reverse().map((h, i) => {
                  const isEmailEvent = h.note?.toLowerCase().includes("email confirmation");
                  const text = h.note ?? `Order status changed to ${statusByKey.get(String(h.status))?.labelEn ?? h.status}`;
                  return (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="mt-1.5"><TimelineDot active={!!h.adminName} /></div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-text">
                          {text}{h.adminName && !isEmailEvent && ` — Updated by: ${h.adminName}`}
                        </p>
                        <p className="text-xs" style={{ color: GREEN }}>{new Date(h.createdAt).toLocaleString()}</p>
                      </div>
                      {isEmailEvent && (
                        <button type="button" disabled={resendConfirmation.isPending} onClick={() => resendConfirmation.mutate()} className={outlineBtn}>
                          {resendConfirmation.isPending ? "Sending…" : "Resend"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Refund */}
            <div className="rounded-card border border-border bg-surface p-4">
              <h3 className="mb-3 text-base font-semibold text-text">Refund</h3>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-secondary">Amount</span>
                  <input type="number" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)}
                    className="num h-10 w-32 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
                </label>
                <label className="flex flex-1 flex-col gap-1.5">
                  <span className="text-xs font-semibold text-secondary">Reason (optional)</span>
                  <input value={refundReason} onChange={(e) => setRefundReason(e.target.value)}
                    className="h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
                </label>
                <Button type="button" variant="ghost" disabled={refund.isPending || !refundAmount}
                  onClick={() => refund.mutate({ amount: Number(refundAmount), reason: refundReason || undefined })}>
                  {refund.isPending ? "Processing…" : "Issue refund"}
                </Button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: sidebar */}
          <div className="flex flex-col gap-5">
            <div className="rounded-card border border-border bg-surface p-4">
              {/* Customer */}
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-text">Customer</h3>
                {order.customerId && (
                  <Link href={`/customers/${order.customerId}`} className="inline-flex" style={{ color: GREEN }} aria-label="View customer">
                    <Icon name="edit" size={16} />
                  </Link>
                )}
              </div>
              <div className="mb-4 flex flex-col gap-1 text-sm">
                <div className="mb-1 grid h-10 w-10 place-items-center rounded-full text-base font-bold text-white" style={{ backgroundColor: GREEN }}>
                  {(shippingAddress?.recipientName ?? "?").trim().charAt(0).toUpperCase()}
                </div>
                <p className="text-muted">0 order(s)</p>
                <p className="font-semibold text-text">{shippingAddress?.recipientName}</p>
                {shippingAddress?.email && <a href={`mailto:${shippingAddress.email}`} style={{ color: BLUE }}>{shippingAddress.email}</a>}
                {shippingAddress?.phone && <a href={`tel:${shippingAddress.phone}`} style={{ color: BLUE }}>{shippingAddress.phone}</a>}
                <p className="text-muted">{order.customerId ? "Have an account already" : "Guest checkout"}</p>
              </div>

              {/* Shipping information */}
              <div className="mb-4 border-t border-border pt-4">
                <h3 className="mb-2 text-base font-semibold text-text">Shipping information</h3>
                <div className="flex flex-col gap-1 text-sm text-text">
                  <p>{shippingAddress?.recipientName}</p>
                  <div className="flex items-center gap-2">
                    {shippingAddress?.phone && <a href={`tel:${shippingAddress.phone}`} style={{ color: BLUE }}>{shippingAddress.phone}</a>}
                    {shippingAddress?.phone && (
                      <button type="button" onClick={() => setShowRisk(true)} className="text-xs text-muted underline">
                        Check risk
                      </button>
                    )}
                  </div>
                  <p>{shippingAddress?.addressLine}</p>
                  <p>{[shippingAddress?.area, shippingAddress?.district].filter(Boolean).join(", ")}</p>
                  <p>{shippingAddress?.division}</p>
                  <p>BD</p>
                  {shippingAddress?.addressLine && (
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent([shippingAddress.addressLine, shippingAddress.district, shippingAddress.division].filter(Boolean).join(", "))}`}
                      target="_blank" rel="noreferrer" style={{ color: BLUE }}
                    >
                      See on maps
                    </a>
                  )}
                </div>
                {billingAddress && billingAddress.addressLine !== shippingAddress?.addressLine && (
                  <div className="mt-3 border-t border-border pt-3">
                    <p className="mb-1 text-xs font-semibold uppercase text-muted">Billing address</p>
                    <p className="text-sm text-text">{billingAddress.recipientName} — {billingAddress.addressLine}</p>
                  </div>
                )}
              </div>

              {/* Referral */}
              <div className="border-t border-border pt-4">
                <h3 className="mb-2 text-base font-semibold text-text">Referral</h3>
                <div className="flex flex-col gap-2 text-sm text-text">
                  <div><span className="block text-xs font-semibold text-muted">IP</span>{order.ipAddress ?? "—"}</div>
                  <div><span className="block text-xs font-semibold text-muted">Landing domain</span>{order.landingDomain ?? "—"}</div>
                  <div><span className="block text-xs font-semibold text-muted">Landing page</span>{order.landingPage ?? "—"}</div>
                  <div><span className="block text-xs font-semibold text-muted">Referral URL</span><span className="break-all">{order.referrerUrl ?? "—"}</span></div>
                  <div><span className="block text-xs font-semibold text-muted">Referral domain</span>{order.referrerDomain ?? "—"}</div>
                </div>
              </div>

              {/* Origin / Division / Source — editable, kept in the sidebar near the data they describe */}
              <div className="mt-4 border-t border-border pt-4">
                <h3 className="mb-2 text-base font-semibold text-text">Order details</h3>
                <div className="flex flex-col gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-muted">Origin</span>
                    <select value={order.channel} onChange={(e) => updateDetails.mutate({ channel: e.target.value as OrderChannel })}
                      className="h-9 rounded-sm border border-border bg-surface px-2 text-sm text-text">
                      {ORDER_CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-muted">Division</span>
                    <select value={shippingAddress?.division ?? ""} onChange={(e) => updateDetails.mutate({ division: e.target.value })}
                      className="h-9 rounded-sm border border-border bg-surface px-2 text-sm text-text">
                      <option value="">—</option>
                      {BD_DIVISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-muted">Source</span>
                    <input
                      defaultValue={order.utmSource ?? ""}
                      onBlur={(e) => e.target.value !== (order.utmSource ?? "") && updateDetails.mutate({ utmSource: e.target.value })}
                      placeholder="e.g. facebook, google"
                      className="h-9 rounded-sm border border-border bg-surface px-2 text-sm text-text"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button type="button" disabled={reorder.isPending} className={`${outlineBtn} flex-1 justify-center`}
                onClick={() => reorder.mutate(undefined, { onSuccess: () => onClose() })}>
                {reorder.isPending ? "Creating…" : "Reorder"}
              </button>
              <button type="button" disabled={updateStatus.isPending} className={`${outlineBtn} flex-1 justify-center`}
                onClick={() => updateStatus.mutate({ status: "CANCELED", note: "Canceled by staff" })}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showConsign && <ConsignModal order={row} onClose={() => setShowConsign(false)} />}
      {showRisk && row.shippingPhone && <FraudDetailModal phone={row.shippingPhone} onClose={() => setShowRisk(false)} />}
    </Modal>
  );
}
