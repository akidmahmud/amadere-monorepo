"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, Icon } from "@amader/admin-ui";
import { toLocalBdPhone } from "@amader/shared";
import {
  DistrictAutocomplete,
  ThanaAutocomplete,
} from "@/components/DistrictThanaFields";
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

type Line = { productId: number; variantId?: number; name: string; sku: string | null; quantity: number; unitPrice: number; imageUrl?: string };

const PAYMENT_PROVIDERS = ["COD", "BKASH", "NAGAD", "ROCKET", "UPAY"] as const;
const PAYMENT_PROVIDER_CONFIG: Record<
  (typeof PAYMENT_PROVIDERS)[number],
  { label: string; icon: string; accentColor: string; bgActive: string }
> = {
  COD: { label: "Cash on Delivery", icon: "payments", accentColor: "#10b981", bgActive: "bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-400" },
  BKASH: { label: "bKash", icon: "account_balance_wallet", accentColor: "#e2136e", bgActive: "bg-pink-500/10 border-pink-500 text-pink-700 dark:text-pink-400" },
  NAGAD: { label: "Nagad", icon: "account_balance_wallet", accentColor: "#f7941d", bgActive: "bg-orange-500/10 border-orange-500 text-orange-700 dark:text-orange-400" },
  ROCKET: { label: "Rocket", icon: "account_balance_wallet", accentColor: "#8c3494", bgActive: "bg-purple-500/10 border-purple-500 text-purple-700 dark:text-purple-400" },
  UPAY: { label: "Upay", icon: "account_balance_wallet", accentColor: "#00a7e1", bgActive: "bg-cyan-500/10 border-cyan-500 text-cyan-700 dark:text-cyan-400" },
};

// WEBSITE and APP are deliberately absent: those are set by the storefront
// itself, and this form only ever creates orders staff took by hand.
const CHANNELS = [
  "WHATSAPP", "PHONE", "FACEBOOK", "INSTAGRAM",
  "TIKTOK", "YOUTUBE", "X", "MARKETPLACE", "POS",
] as const;
const CHANNEL_CONFIG: Record<(typeof CHANNELS)[number], { label: string; icon: string }> = {
  WHATSAPP: { label: "WhatsApp", icon: "chat" },
  PHONE: { label: "Telemarketing", icon: "call" },
  FACEBOOK: { label: "Facebook", icon: "thumb_up" },
  INSTAGRAM: { label: "Instagram", icon: "photo_camera" },
  TIKTOK: { label: "TikTok", icon: "music_note" },
  YOUTUBE: { label: "YouTube", icon: "play_circle" },
  X: { label: "X", icon: "close" },
  MARKETPLACE: { label: "Marketplace", icon: "store" },
  POS: { label: "In-store POS", icon: "point_of_sale" },
};

const PAYMENT_STATUSES = ["PENDING", "CAPTURED", "FAILED"] as const;
const PAYMENT_STATUS_CONFIG: Record<
  (typeof PAYMENT_STATUSES)[number],
  { label: string; badgeClass: string }
> = {
  PENDING: { label: "Pending", badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  CAPTURED: { label: "Paid", badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  FAILED: { label: "Failed", badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30" },
};

const modernInputClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text transition-all duration-200 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 placeholder:text-muted";

function ProductThumb({ url }: { url?: string }) {
  if (!url) {
    return (
      <div className="grid h-11 w-11 flex-none place-items-center rounded-lg border border-border bg-surface-2 text-base">
        📦
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="h-11 w-11 flex-none rounded-lg border border-border object-cover shadow-sm" />;
}

function ModernField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wide text-secondary">
          {label}
          {required && <span className="text-danger font-bold"> *</span>}
        </span>
        {hint && <span className="text-[11px] text-muted">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function ModernAddressFields({
  value,
  onChange,
}: {
  value: CreateManualOrderAddress;
  onChange: (a: CreateManualOrderAddress) => void;
}) {
  function set(key: keyof CreateManualOrderAddress, v: string) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <ModernField label="Recipient Phone" required>
        <div className="relative">
          <input
            type="tel"
            value={value.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="01XXXXXXXXX"
            pattern="(?:\+?880|0)?1\d{9}"
            title="Enter a valid Bangladeshi mobile number, e.g. 01712345678"
            className={modernInputClass}
          />
        </div>
      </ModernField>

      <ModernField label="Recipient Name" required>
        <input
          value={value.recipientName}
          onChange={(e) => set("recipientName", e.target.value)}
          placeholder="Full name"
          className={modernInputClass}
        />
      </ModernField>

      <div className="sm:col-span-2">
        <ModernField label="Delivery Address" required hint="House, road, landmark">
          <textarea
            value={value.addressLine}
            onChange={(e) => set("addressLine", e.target.value)}
            placeholder="House no., Road no., Area / Neighborhood details..."
            rows={2}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text transition-all duration-200 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 placeholder:text-muted"
          />
        </ModernField>
      </div>

      <ModernField label="District" required>
        <DistrictAutocomplete
          value={value.district}
          onChange={(next) => {
            // The area belongs to the old district — keeping it would ship a
            // Dhaka thana to a Sylhet address.
            onChange({ ...value, district: next, area: "" });
          }}
        />
      </ModernField>

      <ModernField label="Thana / Area" required>
        <ThanaAutocomplete
          district={value.district}
          value={value.area ?? ""}
          onChange={(next) => set("area", next)}
        />
      </ModernField>

      <ModernField label="Landmark (Optional)">
        <input
          value={value.landmark ?? ""}
          onChange={(e) => set("landmark", e.target.value)}
          placeholder="e.g. Near City Bank"
          className={modernInputClass}
        />
      </ModernField>

      <ModernField label="Alt. Phone (Optional)">
        <input
          type="tel"
          value={value.alternativePhone ?? ""}
          onChange={(e) => set("alternativePhone", e.target.value)}
          placeholder="01XXXXXXXXX"
          className={modernInputClass}
        />
      </ModernField>

      <ModernField label="Email Address (Optional)">
        <input
          type="email"
          value={value.email ?? ""}
          onChange={(e) => set("email", e.target.value)}
          placeholder="customer@example.com"
          className={modernInputClass}
        />
      </ModernField>

      <ModernField label="Postal Code (Optional)">
        <input
          value={value.postCode ?? ""}
          onChange={(e) => set("postCode", e.target.value)}
          placeholder="e.g. 1212"
          className={modernInputClass}
        />
      </ModernField>
    </div>
  );
}

export interface NewOrderFormProps {
  initialCustomerId?: number | null;
  onCreated: (order: AdminOrder) => void;
  onCancel: () => void;
}

export function NewOrderFormModern({
  initialCustomerId,
  onCreated,
  onCancel,
}: NewOrderFormProps) {
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
      return [
        ...ls,
        {
          productId: item.productId,
          variantId: item.variantId,
          name: item.name,
          sku: item.sku,
          quantity: 1,
          unitPrice: Number(item.price ?? 0),
          imageUrl: item.imageUrl,
        },
      ];
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Live Summary Quick Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-gradient-to-r from-brand-500/10 via-purple-500/5 to-surface p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-white shadow-sm">
            <Icon name="shopping_cart" size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-text">New Order Draft</h2>
              <span className="rounded-full bg-brand-500/15 px-2.5 py-0.5 text-xs font-semibold text-brand-600 dark:text-brand-400">
                Manual Sale
              </span>
            </div>
            <p className="text-xs text-secondary">
              {lines.length === 0
                ? "Add products and select a customer to complete"
                : `${lines.length} item(s) selected in cart`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className="block text-xs font-medium text-secondary">Total Amount</span>
            <span className="num text-xl font-extrabold tracking-tight text-brand-600 dark:text-brand-400">
              ৳{totalAmount.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Customer & Shipping Address (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          {/* Customer Selection Card */}
          <Card className="space-y-4 p-5 shadow-card">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Icon name="person" className="text-brand-500" size={20} />
                <h3 className="font-bold text-text">Customer Information</h3>
              </div>
              {selectedCustomer && (
                <button
                  type="button"
                  onClick={() => {
                    // Also clears the address. Nulling only the customer left
                    // the previous person's name, phone and street address in
                    // the form. prefilledCustomerId is reset so re-picking the
                    // SAME customer prefills again instead of no-opping on the
                    // effect's already-done guard.
                    setCustomerId(null);
                    setSelectedCustomerInfo(null);
                    setAddress(EMPTY_ADDRESS);
                    setBillingAddress(EMPTY_ADDRESS);
                    prefilledCustomerId.current = null;
                  }}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10"
                >
                  <Icon name="swap_horiz" size={14} />
                  Change
                </button>
              )}
            </div>

            {selectedCustomer ? (
              <div className="flex items-center gap-3.5 rounded-xl border border-brand-500/20 bg-brand-500/5 p-3.5">
                <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-brand-500 text-lg font-extrabold text-white shadow-sm">
                  {selectedCustomer.name.trim().charAt(0).toUpperCase() || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="truncate font-bold text-text">{selectedCustomer.name}</h4>
                    {selectedCustomer.tier && (
                      <span className="rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                        {selectedCustomer.tier}
                      </span>
                    )}
                  </div>
                  {selectedCustomer.phone && (
                    <p className="flex items-center gap-1 text-xs text-secondary">
                      <Icon name="call" size={12} className="text-muted" />
                      {toLocalBdPhone(selectedCustomer.phone)}
                    </p>
                  )}
                  <p className="mt-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    ✓ {selectedCustomer.completedOrderCount} order(s) completed
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <input
                    value={customerQuery}
                    onChange={(e) => {
                      setCustomerQuery(e.target.value);
                      setCustomerDropdownOpen(true);
                    }}
                    onFocus={() => setCustomerDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setCustomerDropdownOpen(false), 150)}
                    placeholder="Search by customer name or phone number..."
                    className={modernInputClass}
                  />
                  <div className="absolute right-3 top-2.5 text-muted pointer-events-none">
                    <Icon name="search" size={18} />
                  </div>
                </div>

                {customerDropdownOpen && (
                  <div className="absolute z-20 mt-1.5 flex w-full flex-col gap-1 rounded-xl border border-border bg-surface p-2 shadow-pop max-h-64 overflow-y-auto">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setCreateModalOpen(true);
                        setCustomerDropdownOpen(false);
                      }}
                      className="flex items-center gap-2.5 rounded-lg border border-dashed border-brand-500/40 bg-brand-500/5 px-3 py-2.5 text-left text-xs font-bold text-brand-600 hover:bg-brand-500/10 dark:text-brand-400"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-white text-xs">+</span>
                      Create New Customer
                    </button>

                    {customerResults?.items.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectCustomer(c)}
                        className="flex items-center gap-3 rounded-lg p-2 text-left hover:bg-surface-2 transition-colors"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/15 text-xs font-bold text-brand-600 dark:text-brand-400">
                          {c.name.trim().charAt(0).toUpperCase() || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-bold text-text">{c.name}</div>
                          {c.phone && (
                            <div className="truncate text-[11px] text-muted">{toLocalBdPhone(c.phone)}</div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Delivery Address Card */}
          <Card className="space-y-4 p-5 shadow-card">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Icon name="local_shipping" className="text-brand-500" size={20} />
                <h3 className="font-bold text-text">Delivery Address</h3>
              </div>

              {address.addressLine && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent([address.addressLine, address.district].filter(Boolean).join(", "))}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                >
                  <Icon name="map" size={14} />
                  Google Maps
                </a>
              )}
            </div>

            <ModernAddressFields value={address} onChange={setAddress} />

            {/* Billing Address Toggle */}
            <div className="border-t border-border/60 pt-4">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sameBilling}
                  onChange={(e) => setSameBilling(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500"
                />
                <span className="text-xs font-semibold text-text">
                  Billing address is same as shipping address
                </span>
              </label>

              {!sameBilling && (
                <div className="mt-4 space-y-3 rounded-xl border border-border bg-surface-2 p-4">
                  <h4 className="text-xs font-bold text-text">Separate Billing Address</h4>
                  <ModernAddressFields value={billingAddress} onChange={setBillingAddress} />
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Cart Products & Order Financials (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          {/* Order Items & Product Search Card */}
          <Card className="space-y-4 p-5 shadow-card">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Icon name="inventory_2" className="text-brand-500" size={20} />
                <h3 className="font-bold text-text">Cart & Products</h3>
              </div>
              <span className="text-xs font-semibold text-secondary">
                {lines.reduce((sum, l) => sum + l.quantity, 0)} total unit(s)
              </span>
            </div>

            {/* Product Search Input */}
            <div className="relative">
              <input
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                placeholder="Search products by name or SKU to add..."
                className={modernInputClass}
              />
              <div className="absolute right-3 top-2.5 text-muted pointer-events-none">
                <Icon name="search" size={18} />
              </div>

              {productResults && productResults.length > 0 && (
                <div className="absolute z-20 mt-1.5 flex w-full flex-col gap-1 rounded-xl border border-border bg-surface p-2 shadow-pop max-h-72 overflow-y-auto">
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
                              className="flex items-center justify-between rounded-lg p-2 text-left hover:bg-surface-2 disabled:opacity-50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <ProductThumb url={p.thumbnailUrl ?? undefined} />
                                <div>
                                  <div className="text-xs font-bold text-text">
                                    {p.name} — <span className="text-brand-600 dark:text-brand-400">{v.sku ?? `Variant #${v.id}`}</span>
                                  </div>
                                  <div className="text-[11px] text-muted">৳{v.salePrice ?? v.price ?? "0"}</div>
                                </div>
                              </div>
                              <div className="text-right">
                                {outOfStock && <span className="text-[10px] font-bold text-rose-500">Out of stock</span>}
                                {notPublished && <span className="text-[10px] font-bold text-amber-500">Unpublished</span>}
                                {!outOfStock && !notPublished && (
                                  <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                                    + Add Item
                                  </span>
                                )}
                              </div>
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
                              className="flex items-center justify-between rounded-lg p-2 text-left hover:bg-surface-2 disabled:opacity-50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <ProductThumb url={p.thumbnailUrl ?? undefined} />
                                <div>
                                  <div className="text-xs font-bold text-text">{p.name}</div>
                                  <div className="text-[11px] text-muted">
                                    ৳{p.salePrice ?? p.price ?? "0"} {p.sku ? `(${p.sku})` : ""}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                {outOfStock && <span className="text-[10px] font-bold text-rose-500">Out of stock</span>}
                                {notPublished && <span className="text-[10px] font-bold text-amber-500">Unpublished</span>}
                                {!outOfStock && !notPublished && (
                                  <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                                    + Add Item
                                  </span>
                                )}
                              </div>
                            </button>,
                          ];
                        })();
                  })}
                </div>
              )}
            </div>

            {/* Line Items List */}
            {lines.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-8 text-center">
                <div className="mb-2 text-3xl">🛒</div>
                <p className="text-xs font-semibold text-secondary">Your order cart is currently empty</p>
                <p className="text-[11px] text-muted">Use the search box above to add items to this sale</p>
              </div>
            ) : (
              <div className="space-y-2">
                {lines.map((l, idx) => (
                  <div
                    key={`${l.productId}-${l.variantId ?? "base"}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 p-3 transition-all hover:border-border/80"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <ProductThumb url={l.imageUrl} />
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-xs font-bold text-text">{l.name}</h4>
                        <div className="flex items-center gap-2 text-[11px] text-muted">
                          <span>Unit Price: ৳{l.unitPrice.toFixed(2)}</span>
                          {l.sku && <span>• SKU: {l.sku}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Quantity Step Controls */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateLineQuantity(idx, Math.max(1, l.quantity - 1))}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-xs font-bold text-text hover:bg-surface-2 active:scale-95"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={l.quantity}
                        onChange={(e) => updateLineQuantity(idx, Math.max(1, Number(e.target.value)))}
                        className="h-7 w-12 rounded-md border border-border bg-surface text-center text-xs font-bold text-text outline-none focus:border-brand-500"
                      />
                      <button
                        type="button"
                        onClick={() => updateLineQuantity(idx, l.quantity + 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-xs font-bold text-text hover:bg-surface-2 active:scale-95"
                      >
                        +
                      </button>
                    </div>

                    {/* Line Total & Delete Button */}
                    <div className="flex items-center gap-3 text-right">
                      <div className="w-20">
                        <span className="num text-xs font-bold text-text">
                          ৳{(l.unitPrice * l.quantity).toFixed(2)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-rose-500 hover:bg-rose-500/10 transition-colors"
                        aria-label="Remove item"
                      >
                        <Icon name="delete" size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Note Input */}
            <div className="pt-2">
              <ModernField label="Order Note / Special Instructions">
                <textarea
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  rows={2}
                  placeholder="Notes about packaging, timing, or special customer requests..."
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
              </ModernField>
            </div>
          </Card>

          {/* Payment, Channel & Financial Summary Card */}
          <Card className="space-y-5 p-5 shadow-card">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Icon name="payments" className="text-brand-500" size={20} />
                <h3 className="font-bold text-text">Payment & Channel</h3>
              </div>
            </div>

            {/* Channel Pills */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold tracking-wide text-secondary">Sales Channel</span>
              {/* 3 columns, not 4: nine channels divide evenly into three
                  rows instead of leaving a lone orphan on the last one. */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CHANNELS.map((c) => {
                  const active = channel === c;
                  const cfg = CHANNEL_CONFIG[c];
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setChannel(c)}
                      className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition-all ${
                        active
                          ? "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400 shadow-sm"
                          : "border-border bg-surface hover:bg-surface-2 text-secondary"
                      }`}
                    >
                      <Icon name={cfg.icon} size={16} />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Payment Method Pills */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold tracking-wide text-secondary">Payment Method</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {PAYMENT_PROVIDERS.map((p) => {
                  const active = paymentProvider === p;
                  const cfg = PAYMENT_PROVIDER_CONFIG[p];
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPaymentProvider(p)}
                      className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-2 text-xs font-bold transition-all ${
                        active ? cfg.bgActive + " shadow-sm" : "border-border bg-surface hover:bg-surface-2 text-secondary"
                      }`}
                    >
                      <span>{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Transaction ID & Payment Status */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ModernField
                label={`Transaction Reference ${transactionIdRequired ? "*" : ""}`}
                hint={transactionIdRequired ? "Required for wallet payments" : "Optional for COD"}
              >
                <input
                  value={transactionId}
                  onChange={(e) => {
                    setTransactionId(e.target.value);
                    if (transactionIdError) setTransactionIdError(false);
                  }}
                  placeholder="Txn ID / TrxID / Ref No."
                  className={`${modernInputClass} ${transactionIdError ? "border-rose-500 focus:ring-rose-500/20" : ""}`}
                />
                {transactionIdError && (
                  <span className="text-[11px] font-semibold text-rose-500">
                    Transaction ID is required for {PAYMENT_PROVIDER_CONFIG[paymentProvider].label}
                  </span>
                )}
              </ModernField>

              <ModernField label="Payment Status">
                <div className="grid grid-cols-3 gap-1.5 rounded-lg border border-border bg-surface-2 p-1">
                  {PAYMENT_STATUSES.map((s) => {
                    const active = paymentStatus === s;
                    const cfg = PAYMENT_STATUS_CONFIG[s];
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setPaymentStatus(s)}
                        className={`rounded-md py-1.5 text-center text-xs font-bold transition-all ${
                          active ? "bg-surface shadow-xs text-text border border-border" : "text-muted hover:text-text"
                        }`}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </ModernField>
            </div>

            {/* Shipping Presets & Calculator */}
            <div className="space-y-2 border-t border-border/60 pt-4">
              <span className="text-xs font-semibold tracking-wide text-secondary">Quick Shipping Fee</span>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Free (৳0)", amount: "0" },
                  { label: "Inside Dhaka (৳60)", amount: "60" },
                  { label: "Outside Dhaka (৳120)", amount: "120" },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setShippingAmount(preset.amount);
                      setEditingShipping(false);
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                      shippingAmount === preset.amount
                        ? "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400"
                        : "border-border bg-surface text-secondary hover:bg-surface-2"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Coupon Code Input */}
            <div className="space-y-1.5">
              <ModernField label="Coupon / Discount Code">
                <div className="flex gap-2">
                  <input
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="e.g. PROMO10"
                    className={modernInputClass}
                  />
                </div>
                {couponCode.trim() && couponPreview.data && (
                  <div
                    className={`mt-1 rounded-md px-2.5 py-1 text-xs font-semibold ${
                      couponPreview.data.error
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {couponPreview.data.error ?? `✓ Valid Coupon — ৳${couponAmountNum.toFixed(2)} discount applied`}
                  </div>
                )}
              </ModernField>
            </div>

            {/* Financial Summary Table */}
            <div className="space-y-2 border-t border-border/60 pt-4 text-xs">
              <div className="flex items-center justify-between text-secondary">
                <span>Subtotal</span>
                <span className="num font-semibold text-text">৳{subAmount.toFixed(2)}</span>
              </div>

              {/* Tax & Promotion Inline Inputs */}
              <div className="grid grid-cols-2 gap-3 py-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted">Tax Amount</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(e.target.value)}
                    className="num h-7 w-20 rounded-md border border-border bg-surface px-2 text-right text-xs text-text outline-none focus:border-brand-500"
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted">Promo Amount</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={promotionAmount}
                    onChange={(e) => setPromotionAmount(e.target.value)}
                    className="num h-7 w-20 rounded-md border border-border bg-surface px-2 text-right text-xs text-text outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-secondary">
                <span>Custom Discount</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    className="num h-7 w-24 rounded-md border border-border bg-surface px-2 text-right text-xs text-text outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-secondary">
                <span>Shipping Fee</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={shippingAmount}
                    onChange={(e) => setShippingAmount(e.target.value)}
                    className="num h-7 w-24 rounded-md border border-border bg-surface px-2 text-right text-xs text-text outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Total Banner */}
              <div className="mt-3 flex items-center justify-between rounded-xl bg-gradient-to-r from-brand-600 to-purple-700 p-4 text-white shadow-md">
                <div>
                  <span className="block text-xs font-semibold text-white/80">Grand Total</span>
                  <span className="text-xs text-white/60">Taxes, discounts & shipping included</span>
                </div>
                <span className="num text-2xl font-extrabold tracking-tight">
                  ৳{totalAmount.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {create.error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
                ⚠️ {create.error instanceof ProxyApiError ? create.error.message : "Failed to create order. Please check inputs."}
              </div>
            )}

            {/* Submit / Cancel Buttons */}
            <div className="flex items-center justify-end gap-3 border-t border-border/60 pt-4">
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={create.isPending || lines.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-2.5 font-bold text-white shadow-md hover:bg-brand-600 disabled:opacity-50 transition-all"
              >
                <Icon name="check_circle" size={18} />
                {create.isPending ? "Creating Order..." : "Confirm & Create Order"}
              </Button>
            </div>
          </Card>
        </div>
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
