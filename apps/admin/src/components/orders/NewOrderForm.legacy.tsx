"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Icon } from "@amader/admin-ui";
import { toLocalBdPhone } from "@amader/shared";
import {
  DistrictAutocomplete,
  ThanaAutocomplete,
} from "@/components/DistrictThanaFields";
import { useCustomer, useCustomers, type AdminCustomer } from "@/hooks/useCustomers";
import { useProductSearch } from "@/hooks/useProducts";
import {
  useCreateManualOrder,
  usePreviewCoupon,
  type AdminOrder,
  type CreateManualOrderAddress,
  type ManualOrderPaymentStatus,
} from "@/hooks/useOrders";
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

type Line = {
  productId: number;
  variantId?: number;
  name: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  imageUrl?: string;
  variantText?: string;
};

const PAYMENT_PROVIDERS = ["COD", "BKASH", "NAGAD", "ROCKET", "UPAY"] as const;
const PAYMENT_PROVIDER_LABELS: Record<(typeof PAYMENT_PROVIDERS)[number], string> = {
  COD: "Cash on delivery (COD)",
  BKASH: "bKash",
  NAGAD: "Nagad",
  ROCKET: "Rocket",
  UPAY: "Upay",
};

const CHANNELS = [
  "WHATSAPP",
  "PHONE",
  "FACEBOOK",
  "INSTAGRAM",
  "TIKTOK",
  "YOUTUBE",
  "X",
  "MARKETPLACE",
  "POS",
] as const;
const CHANNEL_LABELS: Record<(typeof CHANNELS)[number], string> = {
  WHATSAPP: "WhatsApp",
  PHONE: "Phone (Telemarketing)",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  X: "X",
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

const cardInputClass =
  "h-9 rounded border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-[#1e7439]";
const fieldLabelClass = "mb-1 block text-xs font-bold text-slate-700";

function ProductThumb({ url }: { url?: string }) {
  if (!url) {
    return (
      <div className="grid h-12 w-12 flex-none place-items-center rounded border border-slate-200 bg-slate-50 text-sm">
        📦
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="h-12 w-12 flex-none rounded border border-slate-200 object-cover" />
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={fieldLabelClass}>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

function AddressFields({
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
    <div className="grid grid-cols-1 gap-2 pt-2 text-xs">
      <Field label="Phone" required>
        <input
          type="tel"
          value={value.phone}
          onChange={(e) => set("phone", e.target.value)}
          placeholder="01XXXXXXXXX"
          className={cardInputClass + " w-full"}
        />
      </Field>
      <Field label="Recipient name" required>
        <input
          value={value.recipientName}
          onChange={(e) => set("recipientName", e.target.value)}
          placeholder="Full name"
          className={cardInputClass + " w-full"}
        />
      </Field>
      <Field label="Address line" required>
        <textarea
          value={value.addressLine}
          onChange={(e) => set("addressLine", e.target.value)}
          placeholder="House no. / building / street / area"
          rows={2}
          className="w-full rounded border border-slate-200 bg-white p-2 text-xs text-slate-800 outline-none focus:border-[#1e7439]"
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="District" required>
          <DistrictAutocomplete
            value={value.district}
            // The area belongs to the old district — keeping it would ship a
            // Dhaka thana to a Sylhet address.
            onChange={(next) => onChange({ ...value, district: next, area: "" })}
          />
        </Field>
        <Field label="Thana / Area" required>
          <ThanaAutocomplete
            district={value.district}
            value={value.area ?? ""}
            onChange={(next) => set("area", next)}
          />
        </Field>
      </div>
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
  const [isEditingAddress, setIsEditingAddress] = useState(false);
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
  const [editingTax, setEditingTax] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState(false);
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
    email?: string | null;
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
    selectCustomer({
      id: c.id,
      name: c.name,
      phone: c.phone ?? null,
      completedOrderCount: 0,
      tier: null,
      email: c.email,
    });
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

  function addLine(item: {
    productId: number;
    variantId?: number;
    name: string;
    sku: string | null;
    price: string | null;
    imageUrl?: string;
    variantText?: string;
  }) {
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
          variantText: item.variantText,
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

  // Any real field filled in — decides whether the sidebar shows an address
  // at all. recipientName alone is enough (a customer was picked); so is a
  // manually typed street line.
  const hasAddress = Boolean(
    address.recipientName || address.phone || address.addressLine || address.district || address.area,
  );
  const mapsQuery = [address.addressLine, address.area, address.district].filter(Boolean).join(", ");

  /**
   * Clearing the customer clears the address they filled in.
   *
   * It used to only null the customer, leaving the previous person's name,
   * phone and street address sitting in the form -- so the sidebar kept
   * showing a delivery address for someone who was no longer on the order.
   *
   * prefilledCustomerId is reset too, otherwise re-picking the SAME customer
   * would be a no-op: the effect's guard still thought it had already
   * prefilled for that id and would leave the fields blank.
   */
  function clearCustomer() {
    setCustomerId(null);
    setSelectedCustomerInfo(null);
    setAddress(EMPTY_ADDRESS);
    setBillingAddress(EMPTY_ADDRESS);
    setIsEditingAddress(false);
    prefilledCustomerId.current = null;
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
        items: lines.map((l) => ({
          productId: l.productId,
          variantId: l.variantId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 font-sans text-slate-800">
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#1e7439]">
        <span>DASHBOARD</span>
        <span className="text-slate-300">/</span>
        <span>ECOMMERCE</span>
        <span className="text-slate-300">/</span>
        <span>ORDERS</span>
        <span className="text-slate-300">/</span>
        <span className="text-[#1e7439]/80">CREATE AN ORDER</span>
      </div>

      {/* Running total, matching modern view's summary bar. The total was only
          visible after scrolling to the bottom of the left column, which on a
          long cart meant scrolling away from the products to check it. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-5 py-3 shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-slate-800">New Order Draft</h2>
          <p className="text-[11px] text-slate-500">
            {lines.length === 0
              ? "Add products and select a customer to complete"
              : `${lines.length} item(s) · ${selectedCustomer ? selectedCustomer.name : "no customer selected"}`}
          </p>
        </div>
        <div className="text-right">
          <span className="block text-[11px] font-semibold text-slate-500">Total amount</span>
          <span className="text-lg font-extrabold tracking-tight text-[#1e7439]">
            BDT {totalAmount.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        {/* Left Main Section: Order Information */}
        <div className="flex flex-col gap-6 rounded-lg border border-slate-200 bg-white p-6 shadow-xs">
          <h2 className="font-bold text-slate-800 text-lg">Order information</h2>

          {/* Line Items Table */}
          <div className="overflow-hidden rounded border border-slate-200 bg-white">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[11px] font-bold uppercase tracking-wider text-[#1e7439]">
                  <th className="px-4 py-3">PRODUCT NAME</th>
                  <th className="px-4 py-3 w-32 text-left">PRICE</th>
                  <th className="px-4 py-3 w-28 text-center">QUANTITY</th>
                  <th className="px-4 py-3 w-32 text-left">TOTAL</th>
                  <th className="px-4 py-3 w-16 text-center">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400 text-sm">
                      No products added yet. Use the search box below to add items.
                    </td>
                  </tr>
                ) : (
                  lines.map((l, idx) => (
                    <tr key={`${l.productId}-${l.variantId ?? "base"}`} className="border-b border-slate-200/80">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <ProductThumb url={l.imageUrl} />
                          <div>
                            <p className="font-medium text-slate-800 text-sm">
                              {l.name}
                            </p>
                            {l.variantText && (
                              <p className="text-xs text-slate-500 font-normal">
                                {l.variantText}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-medium text-sm">
                        BDT {l.unitPrice.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min={1}
                          value={l.quantity}
                          onChange={(e) => updateLineQuantity(idx, Math.max(1, Number(e.target.value)))}
                          className="h-8 w-14 rounded border border-slate-200 bg-slate-50 text-center font-medium text-slate-800 outline-none focus:border-[#1e7439]"
                        />
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-medium text-sm">
                        BDT {(l.unitPrice * l.quantity).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="text-slate-400 hover:text-red-600 transition-colors p-1"
                          aria-label="Remove item"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Product Search Field */}
          <div className="relative">
            <input
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              placeholder="Search or create a new product"
              className="h-10 w-full rounded border border-slate-200 bg-white px-3.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#1e7439]"
            />
            {productResults && productResults.length > 0 && (
              <div className="absolute z-20 mt-1 flex w-full flex-col gap-1 rounded border border-slate-200 bg-white p-1.5 shadow-lg">
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
                                name: p.name,
                                variantText: `(SKU: ${v.sku ?? `#${v.id}`})`,
                                sku: v.sku,
                                price: v.salePrice ?? v.price,
                                imageUrl: p.thumbnailUrl ?? undefined,
                              })
                            }
                            className="flex items-center gap-3 rounded px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <ProductThumb url={p.thumbnailUrl ?? undefined} />
                            <span>
                              <span className="font-semibold">{p.name}</span> — {v.sku ?? `Variant #${v.id}`} — BDT{" "}
                              {v.salePrice ?? v.price ?? "0"}
                              {outOfStock && <span className="ml-2 font-bold text-red-600">Out of stock</span>}
                              {notPublished && <span className="ml-2 font-bold text-red-600">Not published</span>}
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
                            className="flex items-center gap-3 rounded px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <ProductThumb url={p.thumbnailUrl ?? undefined} />
                            <span>
                              <span className="font-semibold">{p.name}</span> — BDT {p.salePrice ?? p.price ?? "0"}{" "}
                              {p.sku ? `(${p.sku})` : ""}
                              {outOfStock && <span className="ml-2 font-bold text-red-600">Out of stock</span>}
                              {notPublished && <span className="ml-2 font-bold text-red-600">Not published</span>}
                            </span>
                          </button>,
                        ];
                      })();
                })}
              </div>
            )}
          </div>

          {/* Note & Summary Breakdown Section */}
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            {/* Note Input */}
            <div className="w-full md:max-w-[340px]">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-700">Note</span>
                <textarea
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  rows={4}
                  placeholder="Note for order..."
                  className="w-full rounded border border-slate-200 bg-white p-3 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#1e7439]"
                />
              </label>
            </div>

            {/* Financial Summary */}
            <div className="flex w-full flex-col gap-3 text-xs md:max-w-[300px]">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-600">Sub amount</span>
                <span className="font-bold text-slate-800">BDT {subAmount.toFixed(2)}</span>
              </div>

              {/* Tax and Promotion were display-only: the state existed and was
                  posted to the API, but nothing rendered an input, so both were
                  permanently 0 in classic view while modern view could set
                  them. Same edit-in-place pattern as Discount below. */}
              <div className="flex items-center justify-between">
                {editingTax ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      autoFocus
                      value={taxAmount}
                      onChange={(e) => setTaxAmount(e.target.value)}
                      className="h-7 w-20 rounded border border-slate-200 px-2 text-right text-xs font-semibold outline-none focus:border-[#1e7439]"
                    />
                    <button
                      type="button"
                      onClick={() => setEditingTax(false)}
                      className="text-xs font-bold text-[#1e7439] hover:underline"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingTax(true)}
                    className="font-semibold text-slate-600 hover:text-[#1e7439] hover:underline"
                  >
                    Tax Amount
                  </button>
                )}
                <span className="font-bold text-slate-800">BDT {taxAmountNum.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between">
                {editingPromotion ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      autoFocus
                      value={promotionAmount}
                      onChange={(e) => setPromotionAmount(e.target.value)}
                      className="h-7 w-20 rounded border border-slate-200 px-2 text-right text-xs font-semibold outline-none focus:border-[#1e7439]"
                    />
                    <button
                      type="button"
                      onClick={() => setEditingPromotion(false)}
                      className="text-xs font-bold text-[#1e7439] hover:underline"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingPromotion(true)}
                    className="font-semibold text-slate-600 hover:text-[#1e7439] hover:underline"
                  >
                    Promotion amount
                  </button>
                )}
                <span className="font-bold text-slate-800">BDT {promotionAmountNum.toFixed(2)}</span>
              </div>

              {/* Coupon — the code was posted to the API and previewed for
                  validity, but classic view had no field to type it in. */}
              <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="font-semibold text-slate-600" htmlFor="legacy-coupon">
                    Coupon code
                  </label>
                  <input
                    id="legacy-coupon"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="e.g. PROMO10"
                    className="h-7 w-32 rounded border border-slate-200 px-2 text-xs font-semibold uppercase outline-none focus:border-[#1e7439]"
                  />
                </div>
                {couponCode.trim() && couponPreview.data && (
                  <p
                    className={`rounded px-2 py-1 text-[11px] font-semibold ${
                      couponPreview.data.error ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {couponPreview.data.error ?? `✓ Valid — BDT ${couponAmountNum.toFixed(2)} off`}
                  </p>
                )}
                {couponAmountNum > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-600">Coupon discount</span>
                    <span className="font-bold text-slate-800">− BDT {couponAmountNum.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Discount Row */}
              <div className="flex items-center justify-between">
                {editingDiscount ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      autoFocus
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(e.target.value)}
                      className="h-7 w-20 rounded border border-slate-200 px-2 text-right text-xs font-semibold outline-none focus:border-[#1e7439]"
                    />
                    <button
                      type="button"
                      onClick={() => setEditingDiscount(false)}
                      className="text-xs font-bold text-[#1e7439] hover:underline"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingDiscount(true)}
                    className="rounded border border-[#1e7439] px-2.5 py-1 font-ui text-[11px] font-semibold text-[#1e7439] transition-colors hover:bg-emerald-50"
                  >
                    Add discount
                  </button>
                )}
                <span className="font-bold text-slate-800">BDT {discountAmountNum.toFixed(2)}</span>
              </div>

              {/* Shipping Row */}
              <div className="flex items-center justify-between">
                {editingShipping ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      autoFocus
                      value={shippingAmount}
                      onChange={(e) => setShippingAmount(e.target.value)}
                      className="h-7 w-20 rounded border border-slate-200 px-2 text-right text-xs font-semibold outline-none focus:border-[#1e7439]"
                    />
                    <button
                      type="button"
                      onClick={() => setEditingShipping(false)}
                      className="text-xs font-bold text-[#1e7439] hover:underline"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingShipping(true)}
                      className="rounded border border-[#1e7439] px-2.5 py-1 font-ui text-[11px] font-semibold text-[#1e7439] transition-colors hover:bg-emerald-50"
                    >
                      Add shipping fee
                    </button>
                    {shippingAmountNum === 0 && (
                      <span className="text-[11px] font-bold text-slate-800">Free shipping</span>
                    )}
                  </div>
                )}
                <span className="font-bold text-slate-800">BDT {shippingAmountNum.toFixed(2)}</span>
              </div>

              {/* One-tap shipping presets — modern view has these; classic
                  made you type the number every time. */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "Free", amount: "0" },
                  { label: "Inside Dhaka ৳60", amount: "60" },
                  { label: "Outside Dhaka ৳120", amount: "120" },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setShippingAmount(preset.amount);
                      setEditingShipping(false);
                    }}
                    className={`rounded border px-2 py-1 text-[11px] font-semibold transition-colors ${
                      shippingAmount === preset.amount
                        ? "border-[#1e7439] bg-emerald-50 text-[#1e7439]"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Total amount */}
              <div className="flex items-center justify-between pt-2">
                <span className="font-bold text-slate-800">Total amount</span>
                <span className="font-bold text-slate-900 text-sm">BDT {totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Payment Method & Status Controls */}
          <div className="mt-4 flex flex-col gap-4 border-t border-slate-100 pt-4 md:items-end">
            {/* Sales channel. `channel` was posted to the API but classic view
                had no control for it, so every order created here was silently
                filed as WhatsApp -- the default -- no matter where it actually
                came from. That quietly poisons the Overview channel breakdown,
                which is the report the channel field exists to feed. */}
            <div className="w-full md:max-w-[300px]">
              <label className="mb-1.5 block text-right text-xs font-bold text-slate-700">
                Sales channel (source)
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as (typeof CHANNELS)[number])}
                className="h-10 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-[#1e7439]"
              >
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {CHANNEL_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full md:max-w-[300px]">
              <label className="mb-1.5 block text-right text-xs font-bold text-slate-700">
                Payment method
              </label>
              <select
                value={paymentProvider}
                onChange={(e) => setPaymentProvider(e.target.value as (typeof PAYMENT_PROVIDERS)[number])}
                className="h-10 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-[#1e7439]"
              >
                {PAYMENT_PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {PAYMENT_PROVIDER_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full md:max-w-[300px]">
              <label className="mb-1.5 block text-right text-xs font-bold text-slate-700">
                Payment status
              </label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as ManualOrderPaymentStatus)}
                className="h-10 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-[#1e7439]"
              >
                {PAYMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PAYMENT_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>

            {transactionIdRequired && (
              <div className="w-full md:max-w-[300px]">
                <label className="mb-1.5 block text-right text-xs font-bold text-slate-700">
                  Transaction ID <span className="text-red-500">*</span>
                </label>
                <input
                  value={transactionId}
                  onChange={(e) => {
                    setTransactionId(e.target.value);
                    if (transactionIdError) setTransactionIdError(false);
                  }}
                  placeholder="e.g. Reference number"
                  className={`h-10 w-full rounded border bg-white px-3 text-xs text-slate-700 outline-none ${
                    transactionIdError ? "border-red-500" : "border-slate-200 focus:border-[#1e7439]"
                  }`}
                />
              </div>
            )}
          </div>

          {create.error && (
            <p className="text-xs font-semibold text-red-600">
              {create.error instanceof ProxyApiError ? create.error.message : "Failed to create order"}
            </p>
          )}

          {/* Submit Action Bar */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Icon name="credit_card" size={16} />
              Confirm payment and create order
            </span>
            <div className="flex items-center gap-3">
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
              <button
                type="submit"
                disabled={create.isPending || lines.length === 0}
                className="rounded bg-[#1e7439] px-6 py-2.5 font-ui text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#16562a] disabled:opacity-50"
              >
                {create.isPending ? "Creating…" : "Create order"}
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar Section: Customer Information */}
        <div className="flex flex-col gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-xs h-fit">
          {/* Customer Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-800 text-base">Customer</h3>
            {selectedCustomer && (
              <button
                type="button"
                onClick={clearCustomer}
                className="text-slate-400 hover:text-slate-600 p-1 text-sm"
                title="Clear customer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Selected Customer Profile */}
          {selectedCustomer ? (
            <div className="space-y-3 border-b border-slate-100 pb-4">
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FF5722] font-bold text-white text-lg shadow-sm">
                  {selectedCustomer.name.trim().charAt(0).toUpperCase() || "A"}
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingAddress((v) => !v)}
                  className="p-1 text-emerald-700 hover:text-emerald-900 transition-colors"
                  title="Edit Customer Details"
                >
                  <Icon name="edit" size={18} />
                </button>
              </div>

              <div className="space-y-1 text-xs">
                <p className="flex items-center gap-1.5 font-medium text-slate-600">
                  <span>📥</span>
                  <span>{selectedCustomer.completedOrderCount ?? 0} order(s)</span>
                </p>
                <p className="font-semibold text-slate-800 text-sm">{selectedCustomer.name}</p>
                <p className="text-slate-500">{selectedCustomer.email || `${address.phone || "01644443220"}@temporary.com`}</p>
              </div>
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
                className="h-10 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-[#1e7439]"
              />
              {customerDropdownOpen && (
                <div className="absolute z-20 mt-1 flex w-full flex-col gap-1 rounded border border-slate-200 bg-white p-1.5 shadow-lg">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setCreateModalOpen(true);
                      setCustomerDropdownOpen(false);
                    }}
                    className="flex items-center gap-2 rounded px-2 py-2 text-left text-xs font-bold text-[#1e7439] hover:bg-slate-50"
                  >
                    <span className="grid h-6 w-6 place-items-center rounded-full border border-dashed border-[#1e7439] text-xs">
                      +
                    </span>
                    Create new customer
                  </button>
                  {customerQuery.trim() &&
                    customerResults?.items.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectCustomer(c)}
                        className="flex items-center gap-2 rounded px-2 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                      >
                        <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-[#FF5722] text-xs font-bold text-white">
                          {c.name.trim().charAt(0).toUpperCase() || "?"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{c.name}</span>
                          {c.phone && <span className="block truncate text-[11px] text-slate-400">{c.phone}</span>}
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Shipping Address Display / Form */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-800 text-sm">Shipping Address</h4>
              <button
                type="button"
                onClick={() => setIsEditingAddress((v) => !v)}
                className="p-1 text-emerald-700 hover:text-emerald-900 transition-colors"
                title="Edit Shipping Address"
              >
                <Icon name="edit" size={18} />
              </button>
            </div>

            {isEditingAddress ? (
              <AddressFields value={address} onChange={setAddress} />
            ) : hasAddress ? (
              <div className="space-y-2 text-xs leading-relaxed text-slate-600">
                {address.recipientName && (
                  <p className="font-bold text-slate-800">{address.recipientName}</p>
                )}
                {address.phone && <p className="font-medium text-slate-700">{address.phone}</p>}
                {address.addressLine && <p className="font-normal text-slate-700">{address.addressLine}</p>}
                {(address.area || address.district) && (
                  <p className="text-slate-700">{[address.area, address.district].filter(Boolean).join(", ")}</p>
                )}
                {address.postCode && <p className="text-slate-700">{address.postCode}</p>}
                <p className="font-bold text-slate-500">BD</p>
                {mapsQuery && (
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(mapsQuery)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block pt-1 font-semibold text-emerald-700 hover:underline"
                  >
                    See on maps
                  </a>
                )}
              </div>
            ) : (
              /* Empty, not a sample. Every line here used to fall back to
                 hardcoded placeholder data -- a real-looking phone number and
                 a full Bangla street address -- so an order with no customer
                 selected displayed what looked exactly like a confirmed
                 delivery address, down to a working "See on maps" link
                 pointing at Dhaka. */
              <div className="rounded border border-dashed border-slate-200 px-3 py-4 text-center">
                <p className="text-xs font-semibold text-slate-500">No delivery address yet</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Select a customer above, or use the pencil to enter one manually.
                </p>
              </div>
            )}
          </div>

          {/* Billing address. `sameBilling` and `billingAddress` both existed
              and were posted to the API, but classic view rendered no control
              for either -- so sameBilling was permanently true and a separate
              billing address was impossible here, while modern view allowed
              it. */}
          <div className="space-y-3 border-t border-slate-100 pt-3">
            <label className="flex cursor-pointer select-none items-center gap-2">
              <input
                type="checkbox"
                checked={sameBilling}
                onChange={(e) => setSameBilling(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 accent-[#1e7439]"
              />
              <span className="text-xs font-semibold text-slate-700">
                Billing address same as shipping
              </span>
            </label>

            {!sameBilling && (
              <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-3">
                <h4 className="text-xs font-bold text-slate-800">Billing Address</h4>
                <AddressFields value={billingAddress} onChange={setBillingAddress} />
              </div>
            )}
          </div>
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
