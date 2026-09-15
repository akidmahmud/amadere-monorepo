"use client";

import { useMemo, useRef, useState } from "react";
import { Button, Card, Icon } from "@amader/admin-ui";
import {
  DistrictAutocomplete,
  ThanaAutocomplete,
} from "@/components/DistrictThanaFields";
import {
  CHANNEL_COURIERS,
  ORDER_CHANNELS,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  WHOLESALE_COURIERS,
  defaultUnitPrice,
  useCreateWholesaleOrder,
  useWholesaleChannels,
  useWholesaleProducts,
  type PickableProduct,
  type WholesaleChannel,
  type WholesaleCustomer,
  type WholesaleOrderChannel,
  type WholesaleOrderType,
  type WholesalePaymentMethod,
  type WholesalePaymentStatus,
  type WholesalePriceList,
} from "@/hooks/useWholesale";
import { ChannelFieldInputs, missingChannelFields, type ChannelValues } from "./ChannelFieldInputs";
import { Thumb } from "./Thumb";

const money = (v: number | string) =>
  `৳${Number(v || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const INPUT =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none transition-all duration-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 placeholder:text-muted";

/** A Bangladeshi mobile number. The same shape checkout enforces, so an order
 *  taken over the phone cannot be saved against a number a courier will
 *  bounce. */
const phoneOk = (p: string) => /^01[3-9]\d{8}$/.test(p.replace(/\s+/g, ""));

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[11px] font-bold uppercase tracking-wide text-secondary">
        {label}
        {required && <span className="text-danger"> *</span>}
      </span>
      {children}
    </label>
  );
}

function SectionCard({
  title,
  hint,
  hintTone,
  children,
}: {
  title: string;
  hint?: string;
  hintTone?: "brand" | "muted";
  children: React.ReactNode;
}) {
  return (
    <Card className="p-0 shadow-card overflow-visible">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5">
        <h3 className="text-sm font-bold text-text">{title}</h3>
        {hint && (
          <span
            className={`text-[10px] ${
              hintTone === "brand"
                ? "font-bold text-brand-500"
                : "text-muted"
            }`}
          >
            {hint}
          </span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </Card>
  );
}

/** A pill row that behaves like a radio group — the demo's `.seg`. */
function Segmented<T extends string>({
  options,
  value,
  onChange,
  tone = "brand",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  tone?: "brand" | "success";
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === value;
        const active =
          tone === "success"
            ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400";
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={on}
            className={`rounded-lg border px-2.5 py-2 text-[11px] font-bold transition-colors ${
              on
                ? active
                : "border-border bg-surface text-secondary hover:bg-surface-2"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

interface CartLine {
  product: PickableProduct;
  quantity: number;
  unitPrice: string;
  discount: string;
}

const EMPTY_DELIVERY = {
  recipientName: "",
  recipientPhone: "",
  addressLine: "",
  district: "",
  thana: "",
  landmark: "",
  alternativePhone: "",
  recipientEmail: "",
  postCode: "",
};

export function CreateOrderPanel({
  customers,
  onCreateCustomer,
  onCreated,
}: {
  customers: WholesaleCustomer[];
  onCreateCustomer: () => void;
  onCreated: (orderNumber: string) => void;
}) {
  const products = useWholesaleProducts();
  const create = useCreateWholesaleOrder();

  const channels = useWholesaleChannels();
  const activeChannels = (channels.data ?? []).filter((c) => c.isActive);

  const [type, setType] = useState<WholesaleOrderType>("WHOLESALE");
  const wholesale = type === "WHOLESALE";
  // "Others" orders go through an admin-managed channel (Cash Sale, Daraz...),
  // which decides the price list, whether there's a courier leg, and what
  // extra fields the order carries.
  const [channelId, setChannelId] = useState<number | null>(null);
  const [channelValues, setChannelValues] = useState<ChannelValues>({});
  const salesChannel = wholesale ? null : (activeChannels.find((c) => c.id === channelId) ?? null);
  const hasDelivery = wholesale || !!salesChannel?.hasDelivery;
  const priceList: WholesalePriceList = wholesale ? "WHOLESALE" : (salesChannel?.priceList ?? "RETAIL");

  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);

  const [delivery, setDelivery] = useState({ ...EMPTY_DELIVERY });
  const [courier, setCourier] = useState("");
  const [consignmentId, setConsignmentId] = useState("");
  const [paymentStatus, setPaymentStatus] =
    useState<WholesalePaymentStatus>("UNPAID");

  const [productQuery, setProductQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [note, setNote] = useState("");

  const [channel, setChannel] = useState<WholesaleOrderChannel>("WHATSAPP");
  const [method, setMethod] = useState<WholesalePaymentMethod>("CASH");
  const [transactionId, setTransactionId] = useState("");

  const [orderDiscount, setOrderDiscount] = useState("0");
  const [deliveryCharge, setDeliveryCharge] = useState("0");
  const [errors, setErrors] = useState<string[]>([]);

  const customerBoxRef = useRef<HTMLDivElement>(null);
  const selected = customers.find((c) => c.id === customerId) ?? null;

  const customerMatches = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    return customers
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          (c.phone ?? "").includes(q) ||
          (c.alternativePhone ?? "").includes(q),
      )
      .slice(0, 8);
  }, [customers, customerQuery]);

  const productMatches = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return [];
    return (products.data ?? [])
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku ?? "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [products.data, productQuery]);

  const lineTotal = (l: CartLine) =>
    Math.max(0, l.quantity * Number(l.unitPrice || 0) - Number(l.discount || 0));

  const subtotal = cart.reduce((sum, l) => sum + lineTotal(l), 0);
  // A channel with no delivery leg (Cash Sale) has no charge — not merely
  // hidden, excluded from the total, which is what the server also enforces.
  const charge = hasDelivery ? Math.max(0, Number(deliveryCharge || 0)) : 0;
  const discount = Math.max(0, Number(orderDiscount || 0));
  const grandTotal = Math.max(0, subtotal - discount + charge);
  const units = cart.reduce((n, l) => n + l.quantity, 0);

  /**
   * Switching mode re-prices every line.
   *
   * The two modes sell off different price lists, so a cart carried across
   * unchanged would bill a shop at retail (or a walk-in at trade rates) purely
   * because of the order the buttons were pressed in. Per-line discounts are
   * dropped with the old prices they were negotiated against.
   */
  function reprice(list: WholesalePriceList) {
    setCart((lines) =>
      lines.map((l) => ({
        ...l,
        unitPrice: defaultUnitPrice(l.product, list),
        discount: "0",
      })),
    );
  }

  function switchType(next: WholesaleOrderType) {
    setType(next);
    setErrors([]);
    setChannelId(null);
    setChannelValues({});
    setCourier("");
    setPaymentStatus("UNPAID");
    reprice("WHOLESALE");
  }

  /** Picking a channel re-prices the cart to its price list and resets the
   *  delivery leg to match it. */
  function applyChannel(c: WholesaleChannel) {
    setChannelId(c.id);
    setChannelValues({});
    setErrors([]);
    reprice(c.priceList);
    setCourier("");
    setConsignmentId("");
    if (c.hasDelivery) {
      setPaymentStatus("UNPAID");
    } else {
      // Handed over and paid on the spot, as Cash Sale always has been.
      setPaymentStatus("PAID");
      setDeliveryCharge("0");
    }
  }

  function selectCustomer(c: WholesaleCustomer) {
    setCustomerId(c.id);
    setCustomerOpen(false);
    setCustomerQuery("");
    // Their address is the starting point, never the record: what is typed
    // here is snapshotted onto the order, so a later edit to the customer
    // cannot rewrite where this parcel went.
    setDelivery({
      recipientName: c.name,
      recipientPhone: c.phone ?? "",
      addressLine: c.address ?? "",
      district: c.district ?? "",
      thana: c.thana ?? "",
      landmark: c.landmark ?? "",
      alternativePhone: c.alternativePhone ?? "",
      recipientEmail: c.email ?? "",
      postCode: c.postCode ?? "",
    });
  }

  function addProduct(p: PickableProduct) {
    setCart((lines) => {
      const found = lines.find((l) => l.product.id === p.id);
      if (found) {
        return lines.map((l) =>
          l.product.id === p.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...lines,
        {
          product: p,
          quantity: 1,
          unitPrice: defaultUnitPrice(p, priceList),
          discount: "0",
        },
      ];
    });
    setProductQuery("");
  }

  function patchLine(id: number, patch: Partial<CartLine>) {
    setCart((lines) =>
      lines.map((l) => (l.product.id === id ? { ...l, ...patch } : l)),
    );
  }

  function validate(): string[] {
    const errs: string[] = [];
    if (!customerId) errs.push("Select or create a customer.");
    if (!cart.length) errs.push("Add at least one product.");
    if (grandTotal <= 0) errs.push("The order total has to be more than zero.");
    if (!delivery.recipientName.trim()) errs.push("Recipient name is required.");
    if (!phoneOk(delivery.recipientPhone))
      errs.push("A valid recipient phone is required.");
    if (!delivery.addressLine.trim()) errs.push("Delivery address is required.");
    if (!wholesale) {
      if (!salesChannel) errs.push("Choose a channel.");
      else missingChannelFields(salesChannel.fields, channelValues).forEach((label) => errs.push(`${label} is required.`));
    }
    if (hasDelivery && !courier) errs.push("Select a courier or delivery method.");
    if (method !== "CASH" && !transactionId.trim())
      errs.push(
        "A transaction / reference ID is required for a non-cash payment.",
      );
    return errs;
  }

  function reset() {
    setCart([]);
    setOrderDiscount("0");
    setDeliveryCharge("0");
    setConsignmentId("");
    setCourier("");
    setTransactionId("");
    setChannelValues({});
    setNote("");
    setErrors([]);
  }

  async function submit() {
    const errs = validate();
    setErrors(errs);
    if (errs.length) return;

    // What the buyer is treated as having handed over. The server derives the
    // stored payment status from this rather than trusting the dropdown, so
    // the two can never disagree.
    const paidAmount =
      paymentStatus === "PAID"
        ? grandTotal.toFixed(2)
        : paymentStatus === "PARTIALLY_PAID"
          ? undefined
          : "0";

    try {
      const order = await create.mutateAsync({
        partyId: customerId!,
        type,
        channel: wholesale ? channel : undefined,
        channelId: salesChannel?.id,
        channelData: salesChannel ? channelValues : undefined,
        paymentMethod: method,
        transactionId: method === "CASH" ? undefined : transactionId.trim(),
        courier: hasDelivery ? (courier as never) : undefined,
        consignmentId: hasDelivery
          ? consignmentId.trim() || undefined
          : undefined,
        delivery: {
          recipientName: delivery.recipientName.trim(),
          recipientPhone: delivery.recipientPhone.trim(),
          addressLine: delivery.addressLine.trim(),
          district: delivery.district.trim() || undefined,
          thana: delivery.thana.trim() || undefined,
          landmark: delivery.landmark.trim() || undefined,
          alternativePhone: delivery.alternativePhone.trim() || undefined,
          recipientEmail: delivery.recipientEmail.trim() || undefined,
          postCode: delivery.postCode.trim() || undefined,
        },
        items: cart.map((l) => ({
          productId: l.product.id,
          unitPrice: Number(l.unitPrice || 0).toFixed(2),
          quantity: l.quantity,
          discount: Number(l.discount || 0).toFixed(2),
        })),
        deliveryCharge: hasDelivery ? charge.toFixed(2) : undefined,
        discount: discount.toFixed(2),
        paidAmount,
        note: note.trim() || undefined,
      });
      reset();
      onCreated(order.orderNumber);
    } catch (e) {
      setErrors([e instanceof Error ? e.message : "Couldn't create the order"]);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="p-5 shadow-card">
        <h2 className="text-base font-bold text-text">
          {wholesale ? "Create Wholesale Order" : `Create ${salesChannel?.name ?? "Channel"} Order`}
        </h2>
        <p className="mt-1 text-xs text-secondary">
          Pick the channel above the cart — Wholesale, or one from Channel Settings — then add the customer, products and payment.
        </p>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.85fr)_minmax(480px,1.15fr)] items-start">
        {/* ---------------------------------------------------------- left */}
        <div className="space-y-5">
          <SectionCard
            title="Customer"
            hint="A customer must exist before the order does"
          >
            <div className="relative" ref={customerBoxRef}>
              <Field label="Search customer">
                <div className="relative">
                  <input
                    className={`${INPUT} pr-9`}
                    placeholder="Name, phone or alternative phone…"
                    value={customerQuery}
                    autoComplete="off"
                    onFocus={() => setCustomerOpen(true)}
                    onChange={(e) => {
                      setCustomerQuery(e.target.value);
                      setCustomerOpen(true);
                    }}
                    onBlur={() =>
                      // Let a click on an option land before the list closes.
                      window.setTimeout(() => setCustomerOpen(false), 150)
                    }
                  />
                  <Icon
                    name="search"
                    size={18}
                    className="pointer-events-none absolute right-3 top-2.5 text-muted"
                  />
                </div>
              </Field>

              {customerOpen && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-border bg-surface shadow-lg">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={onCreateCustomer}
                    className="flex w-full items-center gap-3 border-b border-border bg-brand-500/5 px-3 py-2.5 text-left text-xs font-bold text-brand-600 hover:bg-brand-500/10 dark:text-brand-400"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500/15">
                      <Icon name="add" size={16} />
                    </span>
                    Create new customer
                  </button>
                  {customerMatches.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectCustomer(c)}
                      className="flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left last:border-b-0 hover:bg-surface-2"
                    >
                      <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-brand-500/15 text-xs font-black text-brand-600 dark:text-brand-400">
                        {c.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-bold text-text">
                          {c.name}
                        </span>
                        <span className="block truncate text-[10px] text-muted">
                          {c.phone}
                          {c.alternativePhone
                            ? ` · Alt ${c.alternativePhone}`
                            : ""}
                        </span>
                      </span>
                    </button>
                  ))}
                  {!customerMatches.length && (
                    <p className="px-3 py-3 text-xs text-muted">
                      No customer matches that.
                    </p>
                  )}
                </div>
              )}
            </div>

            {selected && (
              <div className="mt-3 rounded-xl border border-brand-500/30 bg-brand-500/5 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-brand-500/20 text-lg font-black text-brand-600 dark:text-brand-400">
                      {selected.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-text">
                        {selected.name}
                      </p>
                      <p className="truncate text-[11px] text-secondary">
                        {selected.phone}
                      </p>
                      <p className="mt-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        ✓ {selected.orderCount} order
                        {selected.orderCount === 1 ? "" : "s"} completed
                        {Number(selected.due) > 0 &&
                          ` · ${money(selected.due)} outstanding`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="flex-none rounded-lg border border-border px-2.5 py-1.5 text-[10px] font-bold text-secondary hover:bg-surface-2"
                    onClick={() => {
                      setCustomerId(null);
                      setDelivery({ ...EMPTY_DELIVERY });
                    }}
                  >
                    ↔ Change
                  </button>
                </div>
              </div>
            )}
          </SectionCard>

          {/* The address is kept for BOTH modes — only the courier below is
              wholesale-only. A cash sale is still handed to a named person at
              an address, and that is what goes on the invoice. */}
          <SectionCard
            title="Delivery Address"
            hint={
              selected ? "Filled from the customer" : "Pick a customer first"
            }
            hintTone={selected ? "brand" : "muted"}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Recipient phone" required>
                <input
                  className={INPUT}
                  placeholder="01XXXXXXXXX"
                  value={delivery.recipientPhone}
                  onChange={(e) =>
                    setDelivery({
                      ...delivery,
                      recipientPhone: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Recipient name" required>
                <input
                  className={INPUT}
                  placeholder="Full name"
                  value={delivery.recipientName}
                  onChange={(e) =>
                    setDelivery({
                      ...delivery,
                      recipientName: e.target.value,
                    })
                  }
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Delivery address" required>
                  <textarea
                    className={`${INPUT} h-auto min-h-[72px] py-2`}
                    placeholder="House, road, area / neighbourhood…"
                    value={delivery.addressLine}
                    onChange={(e) =>
                      setDelivery({
                        ...delivery,
                        addressLine: e.target.value,
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="District">
                <DistrictAutocomplete
                  value={delivery.district}
                  onChange={(district) =>
                    // Thanas belong to a district, so the old one is
                    // cleared rather than left pointing somewhere else.
                    setDelivery({ ...delivery, district, thana: "" })
                  }
                />
              </Field>
              <Field label="Thana / area">
                <ThanaAutocomplete
                  district={delivery.district}
                  value={delivery.thana}
                  onChange={(thana) => setDelivery({ ...delivery, thana })}
                />
              </Field>
              <Field label="Landmark">
                <input
                  className={INPUT}
                  placeholder="e.g. Near City Bank"
                  value={delivery.landmark}
                  onChange={(e) =>
                    setDelivery({ ...delivery, landmark: e.target.value })
                  }
                />
              </Field>
              <Field label="Alternative phone">
                <input
                  className={INPUT}
                  placeholder="01XXXXXXXXX"
                  value={delivery.alternativePhone}
                  onChange={(e) =>
                    setDelivery({
                      ...delivery,
                      alternativePhone: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Email address">
                <input
                  className={INPUT}
                  placeholder="customer@example.com"
                  value={delivery.recipientEmail}
                  onChange={(e) =>
                    setDelivery({
                      ...delivery,
                      recipientEmail: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Post code">
                <input
                  className={INPUT}
                  placeholder="e.g. 1212"
                  value={delivery.postCode}
                  onChange={(e) =>
                    setDelivery({ ...delivery, postCode: e.target.value })
                  }
                />
              </Field>
            </div>
          </SectionCard>

          {hasDelivery && (
            <SectionCard title="Courier & Delivery">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Courier / delivery method" required>
                  <select
                    className={INPUT}
                    value={courier}
                    onChange={(e) => setCourier(e.target.value)}
                  >
                    <option value="">Select courier…</option>
                    {(wholesale ? WHOLESALE_COURIERS : CHANNEL_COURIERS).map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Consignment / tracking ID">
                  <input
                    className={INPUT}
                    placeholder="Given by the courier"
                    value={consignmentId}
                    onChange={(e) => setConsignmentId(e.target.value)}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Payment status">
                    <select
                      className={INPUT}
                      value={paymentStatus}
                      onChange={(e) =>
                        setPaymentStatus(
                          e.target.value as WholesalePaymentStatus,
                        )
                      }
                    >
                      {PAYMENT_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {paymentStatus === "PARTIALLY_PAID" && (
                    <p className="mt-1.5 text-[10px] text-muted">
                      Nothing is collected now — record the part payment from
                      the Orders dashboard so it posts to Accounts against
                      this invoice.
                    </p>
                  )}
                </div>
              </div>
            </SectionCard>
          )}
        </div>

        {/* --------------------------------------------------------- right */}
        <div className="space-y-5">
          {/* One selector for every kind of sale. Deliberately first on this
              side: it decides the price list, the delivery leg and what extra
              details the order needs. */}
          <SectionCard title="Channel" hint="Manage channels in Channel Settings">
            <div className="space-y-4">
              <Field label="Channel" required>
                <select
                  className={INPUT}
                  value={wholesale ? "WHOLESALE" : (channelId ?? "")}
                  onChange={(e) => {
                    if (e.target.value === "WHOLESALE") return switchType("WHOLESALE");
                    const next = activeChannels.find((c) => c.id === Number(e.target.value));
                    if (next) {
                      setType("CHANNEL");
                      applyChannel(next);
                    }
                  }}
                >
                  <option value="WHOLESALE">Wholesale</option>
                  {activeChannels.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
              {salesChannel && (
                <ChannelFieldInputs fields={salesChannel.fields} values={channelValues} onChange={setChannelValues} />
              )}
            </div>
          </SectionCard>

          <SectionCard title="Cart & Products" hint={`${units} total unit(s)`}>
            <Field label="Search product">
              <div className="relative">
                <input
                  className={`${INPUT} pr-9`}
                  placeholder="Product name or SKU…"
                  value={productQuery}
                  autoComplete="off"
                  onChange={(e) => setProductQuery(e.target.value)}
                />
                <Icon
                  name="search"
                  size={18}
                  className="pointer-events-none absolute right-3 top-2.5 text-muted"
                />
              </div>
            </Field>

            {productMatches.length > 0 && (
              <div className="mt-2 overflow-hidden rounded-xl border border-border">
                {/* The whole row is the button — a separate "Add" target was
                    a small thing to hit for the one action a result row has. */}
                {productMatches.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addProduct(p)}
                    className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-surface-2"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Thumb url={p.imageUrl} name={p.name} />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-bold text-text">
                          {p.name}
                        </span>
                        <span className="block truncate text-[10px] text-muted">
                          {p.sku ? `SKU ${p.sku} · ` : ""}
                          {money(defaultUnitPrice(p, priceList))}
                          {p.stockStatus === "OUT_OF_STOCK" &&
                            " · out of stock"}
                        </span>
                      </span>
                    </span>
                    <Icon
                      name="add"
                      size={18}
                      className="flex-none text-brand-500"
                    />
                  </button>
                ))}
              </div>
            )}

            {cart.length === 0 ? (
              <div className="mt-3 grid min-h-[140px] place-items-center rounded-xl border border-dashed border-border text-center">
                <div>
                  <p className="text-xs font-bold text-secondary">
                    Your cart is empty
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    Search and add products above
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <div className="hidden gap-2 px-1 text-[9px] font-black uppercase tracking-wide text-muted md:grid md:grid-cols-[minmax(150px,1.4fr)_100px_110px_90px_100px_28px]">
                  <span>Product</span>
                  <span>Qty</span>
                  <span>Price</span>
                  <span>Discount</span>
                  <span className="text-right">Total</span>
                  <span />
                </div>
                {cart.map((l) => (
                  <div
                    key={l.product.id}
                    className="grid grid-cols-2 items-center gap-2 rounded-xl border border-border p-2.5 md:grid-cols-[minmax(150px,1.4fr)_100px_110px_90px_100px_28px] md:rounded-none md:border-0 md:border-b md:border-border md:p-0 md:pb-2.5"
                  >
                    <div className="col-span-2 flex min-w-0 items-center gap-2.5 md:col-span-1">
                      <Thumb url={l.product.imageUrl} name={l.product.name} size={32} />
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-bold text-text">
                          {l.product.name}
                        </p>
                        {l.product.sku && (
                          <p className="truncate text-[9px] text-muted">
                            SKU {l.product.sku}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex h-9 overflow-hidden rounded-lg border border-border">
                      <button
                        type="button"
                        className="w-7 bg-surface-2 font-black text-secondary"
                        onClick={() =>
                          patchLine(l.product.id, {
                            quantity: Math.max(1, l.quantity - 1),
                          })
                        }
                      >
                        −
                      </button>
                      <input
                        className="w-full min-w-0 bg-surface text-center text-xs text-text outline-none"
                        value={l.quantity}
                        onChange={(e) =>
                          patchLine(l.product.id, {
                            quantity: Math.max(
                              1,
                              parseInt(e.target.value || "1", 10) || 1,
                            ),
                          })
                        }
                      />
                      <button
                        type="button"
                        className="w-7 bg-surface-2 font-black text-secondary"
                        onClick={() =>
                          patchLine(l.product.id, { quantity: l.quantity + 1 })
                        }
                      >
                        +
                      </button>
                    </div>
                    <input
                      type="number"
                      min={0}
                      className={`${INPUT} h-9 text-xs`}
                      value={l.unitPrice}
                      onChange={(e) =>
                        patchLine(l.product.id, { unitPrice: e.target.value })
                      }
                    />
                    <input
                      type="number"
                      min={0}
                      className={`${INPUT} h-9 text-xs`}
                      value={l.discount}
                      onChange={(e) =>
                        patchLine(l.product.id, { discount: e.target.value })
                      }
                    />
                    <span className="text-right text-xs font-bold text-text">
                      {money(lineTotal(l))}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${l.product.name}`}
                      className="justify-self-end text-muted hover:text-danger"
                      onClick={() =>
                        setCart((lines) =>
                          lines.filter((x) => x.product.id !== l.product.id),
                        )
                      }
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4">
              <Field label="Order note / special instructions">
                <textarea
                  className={`${INPUT} h-auto min-h-[64px] py-2`}
                  placeholder="Packaging, customer request or delivery note…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title={wholesale ? "Payment & Channel" : "Payment"}
            hint="A non-cash payment needs its transaction ID"
          >
            <div className="space-y-4">
              {wholesale && (
                <Field label="Sales channel">
                  <Segmented
                    options={ORDER_CHANNELS}
                    value={channel}
                    onChange={setChannel}
                  />
                </Field>
              )}

              <Field label="Payment method">
                <Segmented
                  options={PAYMENT_METHODS}
                  value={method}
                  onChange={(m) => {
                    setMethod(m);
                    if (m === "CASH") setTransactionId("");
                  }}
                  tone="success"
                />
              </Field>

              {method !== "CASH" && (
                <Field label="Transaction / reference ID" required>
                  <input
                    className={INPUT}
                    placeholder="From bKash, Nagad, Rocket, Upay or the bank"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                  />
                </Field>
              )}

              <div className="space-y-2 rounded-xl border border-border bg-surface-2 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-secondary">Subtotal</span>
                  <strong className="text-text">{money(subtotal)}</strong>
                </div>
                <div className="grid grid-cols-[1fr_120px] items-center gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-secondary">
                    Order discount
                  </span>
                  <input
                    type="number"
                    min={0}
                    className={`${INPUT} h-9 text-right text-xs`}
                    value={orderDiscount}
                    onChange={(e) => setOrderDiscount(e.target.value)}
                  />
                </div>
                {hasDelivery && (
                  <div className="grid grid-cols-[1fr_120px] items-center gap-3">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-secondary">
                      Courier / delivery charge
                    </span>
                    <input
                      type="number"
                      min={0}
                      className={`${INPUT} h-9 text-right text-xs`}
                      value={deliveryCharge}
                      onChange={(e) => setDeliveryCharge(e.target.value)}
                    />
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-border pt-2.5">
                  <span className="text-sm text-secondary">Grand total</span>
                  <strong className="text-lg font-black text-brand-600 dark:text-brand-400">
                    {money(grandTotal)}
                  </strong>
                </div>
              </div>

              {errors.length > 0 && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-[11px] leading-relaxed text-rose-600 dark:text-rose-400">
                  <strong className="block">Please fix:</strong>
                  <ul className="mt-1 list-inside list-disc">
                    {errors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end border-t border-border pt-4">
              <Button
                variant="primary"
                disabled={create.isPending}
                onClick={submit}
              >
                {create.isPending
                  ? "Saving…"
                  : hasDelivery
                    ? "Create Order"
                    : "Complete Sale"}
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
