"use client";

import { useMemo, useState } from "react";
import { Button, Icon, Modal } from "@amader/admin-ui";
import {
  COURIERS,
  ORDER_STATUSES,
  useCreateWholesaleOrder,
  useUpdateWholesaleOrder,
  useWholesaleProducts,
  type WholesaleCourier,
  type WholesaleCustomer,
  type WholesaleOrder,
  type WholesaleOrderStatus,
} from "@/hooks/useWholesale";

const inputClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text transition-all duration-200 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 placeholder:text-muted";

interface Line {
  productId: number;
  name: string;
  unitPrice: string;
  quantity: number;
}

const money = (n: number) =>
  `৳${n.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function ModalField({
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
    <label className="flex flex-col justify-end space-y-1">
      <div className="flex items-center justify-between gap-1 min-h-[20px]">
        <span className="text-xs font-semibold tracking-wide text-secondary truncate">
          {label}
          {required && <span className="text-danger font-bold"> *</span>}
        </span>
        {hint && (
          <span className="flex-none text-[10px] text-muted whitespace-nowrap leading-none">
            {hint}
          </span>
        )}
      </div>
      {children}
    </label>
  );
}

export function OrderModal({
  open,
  customers,
  presetCustomerId,
  editing,
  onClose,
}: {
  open: boolean;
  customers: WholesaleCustomer[];
  presetCustomerId: number | null;
  /** Present = edit an existing order rather than create a new one. */
  editing?: WholesaleOrder | null;
  onClose: () => void;
}) {
  const create = useCreateWholesaleOrder();
  const update = useUpdateWholesaleOrder();
  const products = useWholesaleProducts();
  const isEdit = !!editing;
  const pending = isEdit ? update.isPending : create.isPending;
  const failure = isEdit ? update.error : create.error;

  const [partyId, setPartyId] = useState(
    editing
      ? String(editing.partyId)
      : presetCustomerId
        ? String(presetCustomerId)
        : "",
  );
  const [courier, setCourier] = useState<WholesaleCourier>(
    editing?.courier ?? "SUNDARBAN",
  );
  const [consignmentId, setConsignmentId] = useState(
    editing?.consignmentId ?? "",
  );
  const [status, setStatus] = useState<WholesaleOrderStatus>(
    editing?.status ?? "PENDING",
  );

  const [lines, setLines] = useState<Line[]>(
    editing
      ? editing.items.map((i) => ({
          // A line whose product was deleted keeps its snapshot name but has
          // no id to send back, so it cannot survive a restatement.
          productId: i.productId ?? 0,
          name: i.name,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
        }))
      : [],
  );
  const [pickQty, setPickQty] = useState("1");
  const [deliveryCharge, setDeliveryCharge] = useState(
    editing?.deliveryCharge ?? "0",
  );
  const [discount, setDiscount] = useState(editing?.discount ?? "0");
  // Only meaningful when creating: on an existing order money is collected
  // through Collect, which posts against the receivable this order raised.
  const [paidAmount, setPaidAmount] = useState("0");
  const [note, setNote] = useState(editing?.note ?? "");

  const [productQuery, setProductQuery] = useState("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);

  const totals = useMemo(() => {
    const subtotal = lines.reduce(
      (sum, l) => sum + Number(l.unitPrice || 0) * l.quantity,
      0,
    );
    const total = Math.max(
      0,
      subtotal + Number(deliveryCharge || 0) - Number(discount || 0),
    );
    // On an existing order the collected figure is whatever the ledger says,
    // not a field on this form — so the outstanding preview reflects the real
    // receivable rather than pretending a fresh payment is being taken.
    const paid = editing ? Number(editing.paid) : Number(paidAmount || 0);
    return { subtotal, total, paid, due: total - paid };
  }, [lines, deliveryCharge, discount, paidAmount, editing]);

  const selected = customers.find((c) => String(c.id) === partyId);

  const filteredProducts = useMemo(() => {
    const list = products.data ?? [];
    if (!productQuery.trim()) return list.slice(0, 50);
    const q = productQuery.toLowerCase();
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        String(p.id).includes(q),
    );
  }, [products.data, productQuery]);

  function addProductToLines(
    product: { id: number; name: string; price: string | null },
    qty: number = 1,
  ) {
    const quantity = Math.max(1, qty);
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) =>
          l.productId === product.id
            ? { ...l, quantity: l.quantity + quantity }
            : l,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unitPrice: product.price ?? "0",
          quantity: quantity,
        },
      ];
    });
    setProductQuery("");
    setPickQty("1");
    setProductDropdownOpen(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const items = lines.map((l) => ({
      productId: l.productId,
      unitPrice: l.unitPrice || "0",
      quantity: l.quantity,
    }));
    try {
      if (editing) {
        // partyId is not sent: moving an order to a different buyer would have
        // to move its receivable too, which is an Accounts decision, not a
        // form field. Cancel and re-enter for that.
        await update.mutateAsync({
          id: editing.id,
          courier,
          consignmentId: consignmentId.trim(),
          status,
          items,
          deliveryCharge,
          discount,
          note: note.trim(),
        });
      } else {
        await create.mutateAsync({
          partyId: Number(partyId),
          courier,
          consignmentId: consignmentId.trim() || undefined,
          status,
          items,
          deliveryCharge,
          discount,
          paidAmount,
          note: note.trim() || undefined,
        });
      }
      onClose();
    } catch {
      // Stays open so the server's message (below) can be read and retried —
      // e.g. restating below what has already been collected.
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        isEdit
          ? `Edit Order — ${editing!.orderNumber}`
          : "Create Wholesale Order"
      }
      className="max-w-4xl"
    >
      <form onSubmit={submit} className="flex flex-col gap-6">
        {/* Quick summary bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-gradient-to-r from-brand-500/10 via-purple-500/5 to-surface p-4 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-white shadow-sm">
              <Icon name="receipt_long" size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-text">
                  {isEdit ? "Restate Wholesale Sale" : "New Wholesale Sale"}
                </h3>
                <span className="rounded-full bg-brand-500/15 px-2.5 py-0.5 text-xs font-semibold text-brand-600 dark:text-brand-400">
                  B2B Order
                </span>
              </div>
              <p className="text-xs text-secondary">
                {lines.length === 0
                  ? "Select buyer and add items to generate invoice"
                  : isEdit
                    ? `${lines.length} line(s) — saving adjusts stock and restates invoice ${editing!.invoiceDocNo ?? ""}`
                    : `${lines.length} product line(s) added`}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="block text-xs font-medium text-secondary">
              Total Payable
            </span>
            <span className="num text-xl font-extrabold tracking-tight text-brand-600 dark:text-brand-400">
              {money(totals.total)}
            </span>
          </div>
        </div>

        {/* Customer & Courier Details */}
        <div className="space-y-4 rounded-xl border border-border bg-surface-2 p-4">
          <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-secondary">
            <Icon name="person" size={16} className="text-brand-500" />
            Customer & Logistics Setup
          </h4>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <ModalField label="Wholesale Customer" required>
                <select
                  className={inputClass}
                  required
                  value={partyId}
                  onChange={(e) => setPartyId(e.target.value)}
                >
                  <option value="">Select a customer</option>
                  {customers
                    .filter((c) => c.isActive)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.phone}
                      </option>
                    ))}
                </select>
              </ModalField>
            </div>

            <ModalField label="Order Status">
              <select
                className={inputClass}
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as WholesaleOrderStatus)
                }
              >
                {ORDER_STATUSES.filter((s) => s.value !== "CANCELLED").map(
                  (s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ),
                )}
              </select>
            </ModalField>

            <ModalField label="Courier Partner" required>
              <select
                className={inputClass}
                value={courier}
                onChange={(e) => setCourier(e.target.value as WholesaleCourier)}
              >
                {COURIERS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </ModalField>

            <div className="sm:col-span-4">
              <ModalField
                label="Consignment / Tracking ID (Optional)"
                hint="Provided by courier upon dispatch"
              >
                <input
                  className={inputClass}
                  placeholder="e.g. CN-9948102"
                  value={consignmentId}
                  onChange={(e) => setConsignmentId(e.target.value)}
                />
              </ModalField>
            </div>
          </div>

          {selected && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-500/20 bg-brand-500/5 px-3 py-2.5 text-xs">
              <div className="flex items-center gap-2">
                <Icon name="verified" size={16} className="text-brand-500" />
                <span className="font-semibold text-text">{selected.name}</span>
                <span className="text-secondary">
                  • {selected.address || "No address on file"}
                </span>
              </div>
              <div className="flex items-center gap-3 font-medium">
                {selected.creditLimit && (
                  <span className="text-secondary">
                    Credit Limit:{" "}
                    <strong className="text-text">
                      ৳{selected.creditLimit}
                    </strong>
                  </span>
                )}
                {Number(selected.due) > 0 && (
                  <span className="rounded-md bg-rose-500/15 px-2 py-0.5 font-bold text-rose-600 dark:text-rose-400">
                    Existing Due: ৳{selected.due}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Product Picker & Order Items */}
        <div className="space-y-4 rounded-xl border border-border bg-surface-2 p-4">
          <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-secondary">
            <Icon name="inventory_2" size={16} className="text-brand-500" />
            Wholesale Products & Pricing
          </h4>

          {/* Searchable Product Combobox */}
          <div className="relative">
            <ModalField
              label="Search & Add Product"
              hint="Type to filter product list"
            >
              <div className="relative">
                <input
                  className={`${inputClass} pl-10 pr-10`}
                  placeholder={
                    products.isLoading
                      ? "Loading catalog..."
                      : "Type product name or ID to search..."
                  }
                  value={productQuery}
                  onChange={(e) => {
                    setProductQuery(e.target.value);
                    setProductDropdownOpen(true);
                  }}
                  onFocus={() => setProductDropdownOpen(true)}
                  onBlur={() =>
                    setTimeout(() => setProductDropdownOpen(false), 200)
                  }
                />
                <div className="absolute left-3 top-2.5 text-muted pointer-events-none">
                  <Icon name="search" size={18} />
                </div>
                {productQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setProductQuery("");
                      setProductDropdownOpen(false);
                    }}
                    className="absolute right-3 top-2.5 text-muted hover:text-text"
                  >
                    <Icon name="close" size={18} />
                  </button>
                )}
              </div>
            </ModalField>

            {productDropdownOpen && (
              <div className="absolute z-30 mt-1 flex w-full flex-col gap-1 rounded-xl border border-border bg-surface p-2 shadow-pop max-h-64 overflow-y-auto">
                {filteredProducts.length === 0 ? (
                  <div className="p-4 text-center text-xs font-semibold text-secondary">
                    No matching products found for &ldquo;{productQuery}&rdquo;
                  </div>
                ) : (
                  filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addProductToLines(p, Number(pickQty) || 1)}
                      className="flex items-center justify-between rounded-lg p-2.5 text-left hover:bg-surface-2 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-border bg-surface-2 text-base">
                          📦
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-bold text-text">
                            {p.name}
                          </div>
                          <div className="text-[11px] font-medium text-secondary">
                            Retail: {p.price ? `৳${p.price}` : "N/A"}{" "}
                            {p.stockStatus ? `• ${p.stockStatus}` : ""}
                          </div>
                        </div>
                      </div>
                      <span className="flex-none rounded-md bg-brand-500/10 px-2.5 py-1 text-xs font-bold text-brand-600 dark:text-brand-400 hover:bg-brand-500/20">
                        + Add to Bill
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-2 text-xs text-secondary">
                <tr>
                  <th className="px-4 py-3 text-left font-bold">
                    Product Item
                  </th>
                  <th className="px-4 py-3 text-left font-bold">
                    Wholesale Rate (৳)
                  </th>
                  <th className="px-4 py-3 text-center font-bold">Quantity</th>
                  <th className="px-4 py-3 text-right font-bold">Line Total</th>
                  <th className="px-4 py-3 text-right font-bold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lines.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-xs text-secondary"
                    >
                      <div className="flex flex-col items-center gap-1.5">
                        <Icon
                          name="shopping_cart"
                          size={28}
                          className="text-muted"
                        />
                        <span>No product lines added yet.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  lines.map((line, i) => (
                    <tr
                      key={line.productId}
                      className="hover:bg-surface-2/60 transition-colors"
                    >
                      <td className="px-4 py-3 font-semibold text-text">
                        {line.name}
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative w-32">
                          <span className="absolute left-2.5 top-2 text-xs font-bold text-muted">
                            ৳
                          </span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="h-8 w-full rounded-md border border-border bg-surface pl-6 pr-2 text-xs font-bold text-text outline-none focus:border-brand-500"
                            value={line.unitPrice}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((l, j) =>
                                  j === i
                                    ? { ...l, unitPrice: e.target.value }
                                    : l,
                                ),
                              )
                            }
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setLines((prev) =>
                                prev.map((l, j) =>
                                  j === i
                                    ? {
                                        ...l,
                                        quantity: Math.max(1, l.quantity - 1),
                                      }
                                    : l,
                                ),
                              )
                            }
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-xs font-bold text-text hover:bg-surface-2 active:scale-95"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={1}
                            className="h-7 w-12 rounded-md border border-border bg-surface text-center text-xs font-bold text-text outline-none focus:border-brand-500"
                            value={line.quantity}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((l, j) =>
                                  j === i
                                    ? {
                                        ...l,
                                        quantity: Math.max(
                                          1,
                                          Number(e.target.value) || 1,
                                        ),
                                      }
                                    : l,
                                ),
                              )
                            }
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setLines((prev) =>
                                prev.map((l, j) =>
                                  j === i
                                    ? { ...l, quantity: l.quantity + 1 }
                                    : l,
                                ),
                              )
                            }
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-xs font-bold text-text hover:bg-surface-2 active:scale-95"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-text">
                        {money(Number(line.unitPrice || 0) * line.quantity)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setLines((prev) => prev.filter((_, j) => j !== i))
                          }
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-rose-500 hover:bg-rose-500/10"
                          title="Remove item"
                        >
                          <Icon name="delete" size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financial Adjustments & Summary */}
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            <div className="grid gap-3 sm:grid-cols-3">
              <ModalField label="Delivery Charge (৳)">
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={deliveryCharge}
                  onChange={(e) => setDeliveryCharge(e.target.value)}
                />
              </ModalField>

              <ModalField label="Discount (৳)">
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </ModalField>

              {isEdit ? (
                // Read-only: collections against a placed order go through
                // Collect, which posts a ledger entry on its receivable. A
                // second "paid" input here would double-count.
                <ModalField
                  label="Already Collected (৳)"
                  hint="Use Collect to add"
                >
                  <div
                    className={`${inputClass} flex items-center bg-surface-2 font-semibold text-emerald-600 dark:text-emerald-400`}
                  >
                    {money(Number(editing!.paid))}
                  </div>
                </ModalField>
              ) : (
                <ModalField label="Paid Now (৳)" hint="Posts to Accounts">
                  <input
                    type="number"
                    min={0}
                    className={inputClass}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                  />
                </ModalField>
              )}
            </div>

            <ModalField label="Order Note (Optional)">
              <input
                className={inputClass}
                placeholder="e.g. Delivered via Sundarban Express hub"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </ModalField>
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-surface-2 p-4 lg:col-span-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-secondary">
              Billing Breakdown
            </h4>
            <div className="space-y-1.5 text-xs">
              <Row label="Subtotal" value={money(totals.subtotal)} />
              <Row
                label="Delivery Charge"
                value={money(Number(deliveryCharge || 0))}
              />
              <Row
                label="Discount"
                value={`− ${money(Number(discount || 0))}`}
              />
              <div className="border-t border-border my-1 pt-1">
                <Row label="Total Bill" value={money(totals.total)} strong />
              </div>
              <Row
                label={isEdit ? "Already Collected" : "Paid Now"}
                value={money(totals.paid)}
              />
              <div className="border-t border-border pt-1">
                <Row
                  label="Outstanding Balance"
                  value={money(totals.due)}
                  strong
                  tone={totals.due > 0 ? "danger" : undefined}
                />
              </div>
            </div>
          </div>
        </div>

        {failure && (
          <div className="rounded-lg bg-rose-500/10 p-3 text-xs font-medium text-rose-600 dark:text-rose-400">
            {failure instanceof Error
              ? failure.message
              : `Couldn't ${isEdit ? "save" : "create"} order`}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={pending || !partyId || lines.length === 0}
          >
            {pending
              ? isEdit
                ? "Saving..."
                : "Creating..."
              : isEdit
                ? "Save Changes"
                : "Create Order"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "danger";
}) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-secondary">{label}</span>
      <span
        className={`${strong ? "font-bold text-sm" : ""} ${tone === "danger" ? "text-rose-600 dark:text-rose-400 font-extrabold" : "text-text"}`}
      >
        {value}
      </span>
    </div>
  );
}
