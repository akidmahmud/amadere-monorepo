"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, Icon } from "@amader/admin-ui";
import { BD_DISTRICTS_BY_DIVISION, BD_THANAS_BY_DISTRICT, toLocalBdPhone } from "@amader/shared";
import { useCustomer, useCustomers, type AdminCustomer } from "@/hooks/useCustomers";
import { useProductSearch } from "@/hooks/useProducts";
import { useCreateManualOrder, usePreviewCoupon, type AdminOrder, type CreateManualOrderAddress, type ManualOrderPaymentStatus } from "@/hooks/useOrders";
import { CreateCustomerModal, type CreateCustomerModalAddress } from "@/components/orders/CreateCustomerModal";
import { ProxyApiError } from "@/lib/api/proxy-client";

const EMPTY_ADDRESS: CreateManualOrderAddress = {
  recipientName: "",
  phone: "",
  alternativePhone: "",
  email: "",
  district: "",
  area: "",
  landmark: "",
  addressLine: "",
  postCode: "",
};

const DISTRICT_OPTIONS = Object.values(BD_DISTRICTS_BY_DIVISION)
  .flat()
  .sort((a, b) => a.localeCompare(b));

type Line = { productId: number; variantId?: number; name: string; sku: string | null; quantity: number; unitPrice: number; imageUrl?: string };

const PAYMENT_PROVIDERS = ["COD", "BKASH", "NAGAD", "ROCKET", "UPAY"] as const;
const PAYMENT_PROVIDER_LABELS: Record<(typeof PAYMENT_PROVIDERS)[number], string> = {
  COD: "Cash on delivery (COD)",
  BKASH: "bKash",
  NAGAD: "Nagad",
  ROCKET: "Rocket",
  UPAY: "Upay",
};

const CHANNELS = ["WHATSAPP", "PHONE", "MARKETPLACE", "POS"] as const;
const CHANNEL_LABELS: Record<(typeof CHANNELS)[number], string> = {
  WHATSAPP: "WhatsApp",
  PHONE: "Phone (Telemarketing)",
  MARKETPLACE: "Marketplace",
  POS: "In-store (POS)",
};

const PAYMENT_STATUSES = ["PENDING", "CAPTURED", "FAILED"] as const;
const PAYMENT_STATUS_LABELS: Record<(typeof PAYMENT_STATUSES)[number], string> = {
  PENDING: "Pending",
  CAPTURED: "Paid",
  FAILED: "Failed",
};

const GREEN = "#1e7439";
const BLUE = "#4299e1";
const RED = "#d63939";

const cardInputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";
const addBtn = "inline-flex h-8 items-center rounded-sm border px-3 text-xs font-semibold";

function ProductThumb({ url }: { url?: string }) {
  if (!url) {
    return <div className="grid h-11 w-11 flex-none place-items-center rounded-sm border border-border bg-surface-2 text-sm">📦</div>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="h-11 w-11 flex-none rounded-sm border border-border object-cover" />;
}

function PencilButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex" style={{ color: GREEN }} aria-label="Edit">
      <Icon name="edit" size={16} />
    </button>
  );
}

const fieldLabelClass = "mb-1 block text-xs font-semibold text-secondary";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={fieldLabelClass}>
        {label}
        {required && <span className="text-danger"> *</span>}
      </span>
      {children}
    </label>
  );
}

function AddressFields({ value, onChange }: { value: CreateManualOrderAddress; onChange: (a: CreateManualOrderAddress) => void }) {
  function set(key: keyof CreateManualOrderAddress, v: string) {
    onChange({ ...value, [key]: v });
  }
  const thanaOptions = value.district ? BD_THANAS_BY_DISTRICT[value.district] : undefined;
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label="Phone" required>
        <input
          type="tel"
          value={value.phone}
          onChange={(e) => set("phone", e.target.value)}
          placeholder="01XXXXXXXXX"
          pattern="(?:\+?880|0)?1\d{9}"
          title="Enter a valid Bangladeshi mobile number, e.g. 01712345678"
          className={cardInputClass + " w-full"}
        />
      </Field>
      <Field label="Recipient name" required>
        <input value={value.recipientName} onChange={(e) => set("recipientName", e.target.value)} placeholder="Full name" className={cardInputClass + " w-full"} />
      </Field>
      <div className="col-span-2">
        <Field label="Address line" required>
          <textarea
            value={value.addressLine}
            onChange={(e) => set("addressLine", e.target.value)}
            placeholder="House no. / building / street / area"
            rows={2}
            className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand-500"
          />
        </Field>
      </div>
      <Field label="District" required>
        <select value={value.district} onChange={(e) => set("district", e.target.value)} className={cardInputClass + " w-full"}>
          <option value="">Select district</option>
          {DISTRICT_OPTIONS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </Field>
      <Field label="Thana / Area" required>
        {thanaOptions ? (
          <select value={value.area ?? ""} onChange={(e) => set("area", e.target.value)} className={cardInputClass + " w-full"}>
            <option value="">Select thana/area</option>
            {thanaOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        ) : (
          <input value={value.area ?? ""} onChange={(e) => set("area", e.target.value)} placeholder="Thana / Area" className={cardInputClass + " w-full"} />
        )}
      </Field>
      <Field label="Landmark (optional)">
        <input value={value.landmark ?? ""} onChange={(e) => set("landmark", e.target.value)} placeholder="Nearby landmark" className={cardInputClass + " w-full"} />
      </Field>
      <Field label="Alternative phone (optional)">
        <input
          type="tel"
          value={value.alternativePhone ?? ""}
          onChange={(e) => set("alternativePhone", e.target.value)}
          placeholder="01XXXXXXXXX"
          pattern="(?:\+?880|0)?1\d{9}"
          title="Enter a valid Bangladeshi mobile number, e.g. 01712345678"
          className={cardInputClass + " w-full"}
        />
      </Field>
      <Field label="Email (optional)">
        <input value={value.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="name@example.com" className={cardInputClass + " w-full"} />
      </Field>
      <Field label="Post code (optional)">
        <input value={value.postCode ?? ""} onChange={(e) => set("postCode", e.target.value)} placeholder="1200" className={cardInputClass + " w-full"} />
      </Field>
    </div>
  );
}

export interface NewOrderFormProps {
  initialCustomerId?: number | null;
  onCreated: (order: AdminOrder) => void;
  onCancel: () => void;
}

export function NewOrderFormLegacy({ initialCustomerId, onCreated, onCancel }: NewOrderFormProps) {
  const [customerId, setCustomerId] = useState<number | null>(initialCustomerId ?? null);
  const { data: customerDetail } = useCustomer(customerId ?? NaN);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const { data: customerResults } = useCustomers({ q: customerQuery || undefined, pageSize: 5 });
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const [address, setAddress] = useState<CreateManualOrderAddress>(EMPTY_ADDRESS);
  const [sameBilling, setSameBilling] = useState(true);
  const [billingAddress, setBillingAddress] = useState<CreateManualOrderAddress>(EMPTY_ADDRESS);

  const prefilledCustomerId = useRef<number | null>(null);
  useEffect(() => {
    if (!customerDetail || prefilledCustomerId.current === customerDetail.id) return;
    prefilledCustomerId.current = customerDetail.id;
    setAddress((a) => ({
      ...a,
      recipientName: customerDetail.name,
      phone: (customerDetail.phone && toLocalBdPhone(customerDetail.phone)) || a.phone,
      email: customerDetail.email ?? a.email,
      addressLine: customerDetail.defaultAddress?.addressLine ?? a.addressLine,
      district: customerDetail.defaultAddress?.district ?? a.district,
      area: customerDetail.defaultAddress?.area ?? a.area,
      landmark: customerDetail.defaultAddress?.landmark ?? a.landmark,
      postCode: customerDetail.defaultAddress?.postCode ?? a.postCode,
      alternativePhone: customerDetail.defaultAddress?.alternativePhone ?? a.alternativePhone,
    }));
  }, [customerDetail]);

  const [productQuery, setProductQuery] = useState("");
  const { data: productResults } = useProductSearch(productQuery);
  const [lines, setLines] = useState<Line[]>([]);

  const [paymentProvider, setPaymentProvider] = useState<(typeof PAYMENT_PROVIDERS)[number]>("COD");
  const [paymentStatus, setPaymentStatus] = useState<ManualOrderPaymentStatus>("PENDING");
  const [transactionId, setTransactionId] = useState("");
  const [taxAmount, setTaxAmount] = useState("0");
  const [promotionAmount, setPromotionAmount] = useState("0");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [editingDiscount, setEditingDiscount] = useState(false);
  const [shippingAmount, setShippingAmount] = useState("0");
  const [editingShipping, setEditingShipping] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("WHATSAPP");
  const [customerNote, setCustomerNote] = useState("");

  const create = useCreateManualOrder();

  const [selectedCustomerInfo, setSelectedCustomerInfo] = useState<{
    id: number;
    name: string;
    phone: string | null;
    completedOrderCount: number;
    tier: string | null;
  } | null>(null);

  const selectedCustomer = customerDetail ?? selectedCustomerInfo ?? undefined;

  function selectCustomer(c: {
    id: number;
    name: string;
    phone: string | null;
    completedOrderCount: number;
    tier: string | null;
    email?: string | null;
  }) {
    setCustomerId(c.id);
    setSelectedCustomerInfo(c);
    setCustomerQuery("");
    setCustomerDropdownOpen(false);
  }

  function handleCustomerCreated(c: AdminCustomer, newAddress: CreateCustomerModalAddress | null) {
    setCreateModalOpen(false);
    selectCustomer({ id: c.id, name: c.name, phone: c.phone ?? null, completedOrderCount: 0, tier: null, email: c.email });
    if (newAddress) {
      setAddress((a) => ({
        ...a,
        addressLine: newAddress.addressLine,
        district: newAddress.district,
        area: newAddress.area,
        landmark: newAddress.landmark,
        postCode: newAddress.postCode,
        alternativePhone: newAddress.alternativePhone,
      }));
    }
  }

  function addLine(item: { productId: number; variantId?: number; name: string; sku: string | null; price: string | null; imageUrl?: string }) {
    setLines((ls) => {
      const idx = ls.findIndex((l) => l.productId === item.productId && l.variantId === item.variantId);
      if (idx >= 0) {
        const copy = [...ls];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 };
        return copy;
      }
      return [...ls, { productId: item.productId, variantId: item.variantId, name: item.name, sku: item.sku, quantity: 1, unitPrice: Number(item.price ?? 0), imageUrl: item.imageUrl }];
    });
    setProductQuery("");
  }

  function updateLineQuantity(idx: number, quantity: number) {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, quantity } : l)));
  }

  function removeLine(idx: number) {
    setLines((ls) => ls.filter((_, i) => i !== idx));
  }

  const subAmount = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const taxAmountNum = Number(taxAmount) || 0;
  const promotionAmountNum = Number(promotionAmount) || 0;
  const discountAmountNum = Number(discountAmount) || 0;
  const shippingAmountNum = Number(shippingAmount) || 0;

  const couponPreview = usePreviewCoupon({
    couponCode: couponCode.trim(),
    items: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
    customerId: customerId ?? undefined,
  });
  const couponAmountNum = couponPreview.data && !couponPreview.data.error ? Number(couponPreview.data.amount) || 0 : 0;

  const totalAmount = Math.max(
    0,
    subAmount - discountAmountNum - promotionAmountNum - couponAmountNum + taxAmountNum + shippingAmountNum,
  );

  function cleanAddress(a: CreateManualOrderAddress): CreateManualOrderAddress {
    return {
      ...a,
      email: a.email || undefined,
      alternativePhone: a.alternativePhone || undefined,
      landmark: a.landmark || undefined,
      postCode: a.postCode || undefined,
    };
  }

  const transactionIdRequired = paymentProvider !== "COD";
  const [transactionIdError, setTransactionIdError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lines.length === 0) return;
    if (transactionIdRequired && !transactionId.trim()) {
      setTransactionIdError(true);
      return;
    }
    setTransactionIdError(false);
    let order;
    try {
      order = await create.mutateAsync({
        customerId: customerId ?? undefined,
        channel,
        shippingAddress: cleanAddress(address),
        billingAddress: sameBilling ? undefined : cleanAddress(billingAddress),
        items: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity, unitPrice: l.unitPrice })),
        paymentProvider,
        taxAmount: taxAmountNum || undefined,
        discountAmount: discountAmountNum || undefined,
        promotionAmount: promotionAmountNum || undefined,
        shippingAmount: shippingAmountNum || undefined,
        couponCode: couponCode.trim() || undefined,
        transactionId: transactionId.trim() || undefined,
        paymentStatus,
        customerNote: customerNote || undefined,
      });
    } catch {
      return;
    }
    onCreated(order);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        {/* Order information */}
        <Card className="flex flex-col gap-4">
          <h3 className="text-base font-semibold text-text">Order information</h3>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              {lines.length > 0 && (
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-2 text-left text-[11px] font-semibold uppercase tracking-wide" style={{ color: GREEN }}>
                      <th className="w-12 px-2 py-2"></th>
                      <th className="px-2 py-2">Product name</th>
                      <th className="px-2 py-2 text-right">Price</th>
                      <th className="px-2 py-2 text-center">Quantity</th>
                      <th className="px-2 py-2 text-right">Total</th>
                      <th className="w-8 px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, idx) => (
                      <tr key={`${l.productId}-${l.variantId ?? "base"}`} className="border-b border-border">
                        <td className="px-2 py-2">
                          <ProductThumb url={l.imageUrl} />
                        </td>
                        <td className="px-2 py-2 text-text">
                          <span className="font-medium" style={{ color: GREEN }}>{l.name}</span>
                          {l.sku && <span className="text-muted"> ({l.sku})</span>}
                        </td>
                        <td className="num px-2 py-2 text-right text-muted">৳{l.unitPrice.toFixed(2)}</td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min={1}
                            value={l.quantity}
                            onChange={(e) => updateLineQuantity(idx, Math.max(1, Number(e.target.value)))}
                            className="num mx-auto h-8 w-16 rounded-sm border border-border bg-surface px-2 text-center text-sm text-text"
                          />
                        </td>
                        <td className="num px-2 py-2 text-right font-semibold text-text">৳{(l.unitPrice * l.quantity).toFixed(2)}</td>
                        <td className="px-2 py-2 text-center">
                          <button type="button" onClick={() => removeLine(idx)} style={{ color: RED }} aria-label="Remove">
                            <Icon name="close" size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div className="relative">
                <input
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  placeholder="Search or create a new product"
                  className={`${cardInputClass} w-full`}
                />
                {productResults && productResults.length > 0 && (
                  <div className="absolute z-10 mt-1 flex w-full flex-col gap-1 rounded-sm border border-border bg-surface p-1.5 shadow-card">
                    {productResults.flatMap((p) => {
                      const notPublished = p.status !== "PUBLISHED";
                      return p.hasVariants
                        ? p.variants.map((v) => {
                            const outOfStock = p.trackInventory && !p.allowBackorder && v.stock - v.reservedStock < 1;
                            return (
                              <button
                                key={`${p.id}-${v.id}`}
                                type="button"
                                disabled={outOfStock}
                                onClick={() =>
                                  addLine({
                                    productId: p.id,
                                    variantId: v.id,
                                    name: `${p.name} — ${v.sku ?? `Variant #${v.id}`}`,
                                    sku: v.sku,
                                    price: v.salePrice ?? v.price,
                                    imageUrl: p.thumbnailUrl ?? undefined,
                                  })
                                }
                                className="flex items-center gap-2 rounded-sm border border-border px-3 py-2 text-left text-sm text-text hover:border-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <ProductThumb url={p.thumbnailUrl ?? undefined} />
                                <span>
                                  {p.name} — {v.sku ?? `Variant #${v.id}`} — ৳{v.salePrice ?? v.price ?? "0"}
                                  {outOfStock && <span className="ml-2 font-bold" style={{ color: RED }}>Out of stock</span>}
                                  {notPublished && <span className="ml-2 font-bold" style={{ color: RED }}>Not published</span>}
                                </span>
                              </button>
                            );
                          })
                        : (() => {
                            const outOfStock = p.trackInventory && !p.allowBackorder && p.stock - p.reservedStock < 1;
                            return [
                              <button
                                key={p.id}
                                type="button"
                                disabled={outOfStock}
                                onClick={() =>
                                  addLine({
                                    productId: p.id,
                                    name: p.name,
                                    sku: p.sku,
                                    price: p.salePrice ?? p.price,
                                    imageUrl: p.thumbnailUrl ?? undefined,
                                  })
                                }
                                className="flex items-center gap-2 rounded-sm border border-border px-3 py-2 text-left text-sm text-text hover:border-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <ProductThumb url={p.thumbnailUrl ?? undefined} />
                                <span>
                                  {p.name} — ৳{p.salePrice ?? p.price ?? "0"} {p.sku ? `(${p.sku})` : ""}
                                  {outOfStock && <span className="ml-2 font-bold" style={{ color: RED }}>Out of stock</span>}
                                  {notPublished && <span className="ml-2 font-bold" style={{ color: RED }}>Not published</span>}
                                </span>
                              </button>,
                            ];
                          })();
                    })}
                  </div>
                )}
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-text">Note</span>
                <textarea
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  rows={4}
                  placeholder="Note for order…"
                  className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand-500"
                />
              </label>
            </div>

            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">Sub amount</span>
                <span className="num font-semibold text-text">৳{subAmount.toFixed(2)}</span>
              </div>

              <label className="flex items-center justify-between gap-3">
                <span className="text-muted">Tax Amount</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={taxAmount}
                  onChange={(e) => setTaxAmount(e.target.value)}
                  className="num h-8 w-28 rounded-sm border border-border bg-surface px-2 text-right text-sm text-text outline-none focus:border-brand-500"
                />
              </label>

              <label className="flex items-center justify-between gap-3">
                <span className="text-muted">Promotion amount</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={promotionAmount}
                  onChange={(e) => setPromotionAmount(e.target.value)}
                  className="num h-8 w-28 rounded-sm border border-border bg-surface px-2 text-right text-sm text-text outline-none focus:border-brand-500"
                />
              </label>

              <div className="flex items-center justify-between">
                {discountAmountNum > 0 || editingDiscount ? (
                  <span className="text-muted">Discount</span>
                ) : (
                  <button type="button" onClick={() => setEditingDiscount(true)} className={addBtn} style={{ borderColor: GREEN, color: GREEN }}>
                    Add discount
                  </button>
                )}
                {editingDiscount ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number" min={0} step="0.01" autoFocus value={discountAmount}
                      onChange={(e) => setDiscountAmount(e.target.value)}
                      className="num h-8 w-24 rounded-sm border border-border bg-surface px-2 text-right text-sm text-text"
                    />
                    <button type="button" className="text-xs font-semibold" style={{ color: GREEN }} onClick={() => setEditingDiscount(false)}>
                      Save
                    </button>
                  </div>
                ) : (
                  <span className="num flex items-center gap-1.5 font-semibold text-text">
                    ৳{discountAmountNum.toFixed(2)}
                    {discountAmountNum > 0 && <PencilButton onClick={() => setEditingDiscount(true)} />}
                  </span>
                )}
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-text">Coupon / discount code</span>
                <input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SAVE10"
                  className={cardInputClass}
                />
                {couponCode.trim() && couponPreview.data ? (
                  <span className="text-xs font-semibold" style={{ color: couponPreview.data.error ? RED : GREEN }}>
                    {couponPreview.data.error ?? `Valid — ৳${couponAmountNum.toFixed(2)} off, already reflected in Total amount`}
                  </span>
                ) : (
                  <span className="text-xs text-muted">
                    Validated live — expiry, usage limits, and minimum order amount are checked against the real coupon.
                  </span>
                )}
              </label>

              <div className="flex items-center justify-between">
                {shippingAmountNum > 0 || editingShipping ? (
                  <span className="text-muted">Shipping fee</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setEditingShipping(true)} className={addBtn} style={{ borderColor: GREEN, color: GREEN }}>
                      Add shipping fee
                    </button>
                    <span className="text-xs font-semibold text-text">Free shipping</span>
                  </div>
                )}
                {editingShipping ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number" min={0} step="0.01" autoFocus value={shippingAmount}
                      onChange={(e) => setShippingAmount(e.target.value)}
                      className="num h-8 w-24 rounded-sm border border-border bg-surface px-2 text-right text-sm text-text"
                    />
                    <button type="button" className="text-xs font-semibold" style={{ color: GREEN }} onClick={() => setEditingShipping(false)}>
                      Save
                    </button>
                  </div>
                ) : (
                  <span className="num flex items-center gap-1.5 font-semibold text-text">
                    ৳{shippingAmountNum.toFixed(2)}
                    {shippingAmountNum > 0 && <PencilButton onClick={() => setEditingShipping(true)} />}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="font-bold text-text">Total amount</span>
                <span className="num font-bold" style={{ color: "#f97316" }}>৳{totalAmount.toFixed(2)}</span>
              </div>

              <label className="mt-2 flex flex-col gap-1.5">
                <span className="text-xs font-bold text-text">Payment method</span>
                <select value={paymentProvider} onChange={(e) => setPaymentProvider(e.target.value as (typeof PAYMENT_PROVIDERS)[number])} className={cardInputClass}>
                  {PAYMENT_PROVIDERS.map((p) => (
                    <option key={p} value={p}>
                      {PAYMENT_PROVIDER_LABELS[p]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-text">Payment status</span>
                <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as ManualOrderPaymentStatus)} className={cardInputClass}>
                  {PAYMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {PAYMENT_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-text">
                  Transaction ID{transactionIdRequired && <span className="ml-0.5 text-danger">*</span>}
                </span>
                <input
                  value={transactionId}
                  onChange={(e) => {
                    setTransactionId(e.target.value);
                    if (transactionIdError) setTransactionIdError(false);
                  }}
                  placeholder="e.g. bKash/Nagad/Rocket/Upay reference"
                  className={cardInputClass}
                  style={transactionIdError ? { borderColor: RED } : undefined}
                />
                {transactionIdError ? (
                  <span className="text-xs font-medium" style={{ color: RED }}>
                    Required for {PAYMENT_PROVIDER_LABELS[paymentProvider]} — enter the reference the customer gave you.
                  </span>
                ) : (
                  <span className="text-xs font-medium" style={{ color: GREEN }}>
                    {transactionIdRequired
                      ? `Required for ${PAYMENT_PROVIDER_LABELS[paymentProvider]}`
                      : "You can leave this field empty if the payment method is Cash on delivery (COD)"}
                  </span>
                )}
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-text">Order channel</span>
                <select value={channel} onChange={(e) => setChannel(e.target.value as (typeof CHANNELS)[number])} className={cardInputClass}>
                  {CHANNELS.map((c) => (
                    <option key={c} value={c}>
                      {CHANNEL_LABELS[c]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {create.error && (
            <p className="text-sm text-danger">
              {create.error instanceof ProxyApiError ? create.error.message : "Failed to create order"}
            </p>
          )}

          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
              <Icon name="credit_card" size={16} />
              Confirm payment and create order
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={create.isPending || lines.length === 0} style={{ backgroundColor: GREEN, borderColor: GREEN }}>
                {create.isPending ? "Creating…" : "Create order"}
              </Button>
            </div>
          </div>
        </Card>

        {/* Customer information */}
        <Card className="flex flex-col gap-3">
          <h3 className="text-base font-semibold text-text">{selectedCustomer ? "Customer" : "Customer information"}</h3>
          {selectedCustomer ? (
            <div className="flex flex-col gap-1 text-sm">
              <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full text-base font-bold text-white" style={{ backgroundColor: GREEN }}>
                {selectedCustomer.name.trim().charAt(0).toUpperCase() || "?"}
              </div>
              <p className="text-muted">{selectedCustomer.completedOrderCount} order(s)</p>
              <p className="font-semibold text-text">{selectedCustomer.name}</p>
              <button
                type="button"
                onClick={() => {
                  setCustomerId(null);
                  setSelectedCustomerInfo(null);
                }}
                className="self-start text-xs font-semibold"
                style={{ color: GREEN }}
              >
                Change customer
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                value={customerQuery}
                onChange={(e) => {
                  setCustomerQuery(e.target.value);
                  setCustomerDropdownOpen(true);
                }}
                onFocus={() => setCustomerDropdownOpen(true)}
                onBlur={() => setTimeout(() => setCustomerDropdownOpen(false), 150)}
                placeholder="Search or create a new customer"
                className={`${cardInputClass} w-full`}
              />
              {customerDropdownOpen && (
                <div className="absolute z-10 mt-1 flex w-full flex-col gap-0.5 rounded-sm border border-border bg-surface p-1.5 shadow-card">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setCreateModalOpen(true);
                      setCustomerDropdownOpen(false);
                    }}
                    className="flex items-center gap-2 rounded-[7px] px-2 py-2 text-left text-sm font-semibold hover:bg-surface-2"
                    style={{ color: GREEN }}
                  >
                    <span className="grid h-7 w-7 flex-none place-items-center rounded-full border border-dashed text-xs" style={{ borderColor: GREEN, color: GREEN }}>+</span>
                    Create new customer
                  </button>
                  {customerQuery.trim() &&
                    customerResults?.items.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectCustomer(c)}
                        className="flex items-center gap-2 rounded-[7px] px-2 py-2 text-left text-sm text-text hover:bg-surface-2"
                      >
                        <span className="grid h-7 w-7 flex-none place-items-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: GREEN }}>
                          {c.name.trim().charAt(0).toUpperCase() || "?"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{c.name}</span>
                          {c.phone && (
                            <span className="flex items-center gap-1 truncate text-xs text-muted">
                              <Icon name="call" size={12} />
                              {c.phone}
                            </span>
                          )}
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          <div className="border-t border-border pt-3">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-text">
              Shipping Address
              <Icon name="edit" size={14} className="text-muted" />
            </h3>
            <AddressFields value={address} onChange={setAddress} />
            {address.addressLine && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent([address.addressLine, address.district, address.division].filter(Boolean).join(", "))}`}
                target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-medium" style={{ color: BLUE }}
              >
                See on maps
              </a>
            )}
          </div>

          <label className="flex items-center gap-2 border-t border-border pt-3 text-sm text-text">
            <input type="checkbox" checked={sameBilling} onChange={(e) => setSameBilling(e.target.checked)} />
            Billing address same as shipping
          </label>
          {!sameBilling && (
            <>
              <h3 className="text-sm font-semibold text-text">Billing address</h3>
              <AddressFields value={billingAddress} onChange={setBillingAddress} />
            </>
          )}
        </Card>
      </div>

      <CreateCustomerModal
        open={createModalOpen}
        initialPhone={customerQuery.trim()}
        onClose={() => setCreateModalOpen(false)}
        onCreated={handleCustomerCreated}
      />
    </form>
  );
}
