"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Card, Icon, PageHeader } from "@amader/admin-ui";
import { useCustomer, useCustomers } from "@/hooks/useCustomers";
import { useProductSearch } from "@/hooks/useProducts";
import { useCreateManualOrder, type CreateManualOrderAddress } from "@/hooks/useOrders";

const newOrderIcon = <Icon name="add_shopping_cart" />;

const EMPTY_ADDRESS: CreateManualOrderAddress = {
  recipientName: "",
  phone: "",
  email: "",
  division: "",
  district: "",
  area: "",
  landmark: "",
  addressLine: "",
  postCode: "",
};

type Line = { productId: number; variantId?: number; name: string; sku: string | null; quantity: number; unitPrice: number };

const PAYMENT_PROVIDERS = ["COD", "BKASH", "NAGAD", "ROCKET", "UPAY"] as const;

function AddressFields({ value, onChange }: { value: CreateManualOrderAddress; onChange: (a: CreateManualOrderAddress) => void }) {
  function set(key: keyof CreateManualOrderAddress, v: string) {
    onChange({ ...value, [key]: v });
  }
  const cls = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";
  return (
    <div className="grid grid-cols-2 gap-3">
      <input value={value.recipientName} onChange={(e) => set("recipientName", e.target.value)} placeholder="Recipient name" className={cls} />
      <input value={value.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Phone" className={cls} />
      <input value={value.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="Email (optional)" className={cls} />
      <input value={value.division} onChange={(e) => set("division", e.target.value)} placeholder="Division" className={cls} />
      <input value={value.district} onChange={(e) => set("district", e.target.value)} placeholder="District" className={cls} />
      <input value={value.area ?? ""} onChange={(e) => set("area", e.target.value)} placeholder="Area/Thana (optional)" className={cls} />
      <input value={value.landmark ?? ""} onChange={(e) => set("landmark", e.target.value)} placeholder="Landmark (optional)" className={cls} />
      <input value={value.postCode ?? ""} onChange={(e) => set("postCode", e.target.value)} placeholder="Post code (optional)" className={cls} />
      <input value={value.addressLine} onChange={(e) => set("addressLine", e.target.value)} placeholder="Address line" className={`col-span-2 ${cls}`} />
    </div>
  );
}

export default function NewOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedId = searchParams.get("customerId");
  const { data: preselected } = useCustomer(preselectedId ? Number(preselectedId) : NaN);

  const [customerId, setCustomerId] = useState<number | null>(preselectedId ? Number(preselectedId) : null);
  const [customerQuery, setCustomerQuery] = useState("");
  const { data: customerResults } = useCustomers({ q: customerQuery || undefined, pageSize: 5 });

  const [address, setAddress] = useState<CreateManualOrderAddress>(EMPTY_ADDRESS);
  const [sameBilling, setSameBilling] = useState(true);
  const [billingAddress, setBillingAddress] = useState<CreateManualOrderAddress>(EMPTY_ADDRESS);

  const [productQuery, setProductQuery] = useState("");
  const { data: productResults } = useProductSearch(productQuery);
  const [lines, setLines] = useState<Line[]>([]);

  const [paymentProvider, setPaymentProvider] = useState<(typeof PAYMENT_PROVIDERS)[number]>("COD");
  const [customerNote, setCustomerNote] = useState("");

  const create = useCreateManualOrder();

  const [selectedCustomerInfo, setSelectedCustomerInfo] = useState<{
    id: number;
    name: string;
    phone: string | null;
    completedOrderCount: number;
    tier: string | null;
  } | null>(null);

  const selectedCustomer = preselected ?? selectedCustomerInfo ?? undefined;

  function selectCustomer(c: { id: number; name: string; phone: string | null; completedOrderCount: number; tier: string | null }) {
    setCustomerId(c.id);
    setSelectedCustomerInfo(c);
    setCustomerQuery("");
    setAddress((a) => ({ ...a, recipientName: c.name, phone: c.phone ?? a.phone }));
  }

  function addLine(item: { productId: number; variantId?: number; name: string; sku: string | null; price: string | null }) {
    setLines((ls) => {
      const idx = ls.findIndex((l) => l.productId === item.productId && l.variantId === item.variantId);
      if (idx >= 0) {
        const copy = [...ls];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 };
        return copy;
      }
      return [...ls, { productId: item.productId, variantId: item.variantId, name: item.name, sku: item.sku, quantity: 1, unitPrice: Number(item.price ?? 0) }];
    });
    setProductQuery("");
  }

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function removeLine(idx: number) {
    setLines((ls) => ls.filter((_, i) => i !== idx));
  }

  const total = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  // Blank optional fields default to "" for controlled inputs, but the
  // backend's CheckoutAddressDto validates email/area/landmark/postCode as
  // IsOptional() — which class-validator only treats as "not provided" for
  // undefined/null, not "". Sending "" for an unset email fails @IsEmail().
  function cleanAddress(a: CreateManualOrderAddress): CreateManualOrderAddress {
    return {
      ...a,
      email: a.email || undefined,
      area: a.area || undefined,
      landmark: a.landmark || undefined,
      postCode: a.postCode || undefined,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lines.length === 0) return;
    const order = await create.mutateAsync({
      customerId: customerId ?? undefined,
      shippingAddress: cleanAddress(address),
      billingAddress: sameBilling ? undefined : cleanAddress(billingAddress),
      items: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity, unitPrice: l.unitPrice })),
      paymentProvider,
      customerNote: customerNote || undefined,
    });
    router.push(`/orders/${order.id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon={newOrderIcon} title="New Order" subtitle="Manually create an order for a phone/in-person sale." />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Card className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-text">Customer</h3>
          {selectedCustomer ? (
            <div className="flex items-center justify-between rounded-sm border border-border bg-surface-2 px-3 py-2">
              <div className="text-sm text-text">
                <div className="font-semibold">{selectedCustomer.name}</div>
                <div className="text-xs text-muted">
                  {selectedCustomer.phone ?? "no phone"} · {selectedCustomer.completedOrderCount} completed orders
                  {selectedCustomer.tier ? ` · ${selectedCustomer.tier}` : ""}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setCustomerId(null);
                  setSelectedCustomerInfo(null);
                  router.replace("/orders/new");
                }}
              >
                Change
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <input
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                placeholder="Search by phone or name — leave blank to create a new customer"
                className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
              />
              {customerQuery.trim() && customerResults && customerResults.items.length > 0 && (
                <div className="flex flex-col gap-1">
                  {customerResults.items.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectCustomer(c)}
                      className="rounded-sm border border-border px-3 py-2 text-left text-sm text-text hover:border-brand-500"
                    >
                      {c.name} — {c.phone ?? "no phone"}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted">No match? Fill in the shipping address below — a new customer is created automatically.</p>
            </div>
          )}
        </Card>

        <Card className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-text">Shipping address</h3>
          <AddressFields value={address} onChange={setAddress} />
          <label className="flex items-center gap-2 text-sm text-text">
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

        <Card className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-text">Products</h3>
          <input
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            placeholder="Search products by name or SKU…"
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
          {productResults && productResults.length > 0 && (
            <div className="flex flex-col gap-1">
              {productResults.flatMap((p) =>
                p.hasVariants
                  ? p.variants.map((v) => (
                      <button
                        key={`${p.id}-${v.id}`}
                        type="button"
                        onClick={() =>
                          addLine({
                            productId: p.id,
                            variantId: v.id,
                            name: `${p.translations[0]?.name ?? p.slug} — ${v.sku ?? `Variant #${v.id}`}`,
                            sku: v.sku,
                            price: v.salePrice ?? v.price,
                          })
                        }
                        className="rounded-sm border border-border px-3 py-2 text-left text-sm text-text hover:border-brand-500"
                      >
                        {p.translations[0]?.name ?? p.slug} — {v.sku ?? `Variant #${v.id}`} — ৳{v.salePrice ?? v.price ?? "0"}
                      </button>
                    ))
                  : [
                      <button
                        key={p.id}
                        type="button"
                        onClick={() =>
                          addLine({
                            productId: p.id,
                            name: p.translations[0]?.name ?? p.slug,
                            sku: p.sku,
                            price: p.salePrice ?? p.price,
                          })
                        }
                        className="rounded-sm border border-border px-3 py-2 text-left text-sm text-text hover:border-brand-500"
                      >
                        {p.translations[0]?.name ?? p.slug} — ৳{p.salePrice ?? p.price ?? "0"} {p.sku ? `(${p.sku})` : ""}
                      </button>,
                    ],
              )}
            </div>
          )}
          {lines.length > 0 && (
            <div className="flex flex-col gap-2">
              {lines.map((l, idx) => (
                <div key={`${l.productId}-${l.variantId ?? "base"}`} className="flex items-center gap-3 rounded-sm border border-border px-3 py-2">
                  <span className="flex-1 text-sm text-text">
                    {l.name}
                    {l.sku ? ` (${l.sku})` : ""}
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={l.quantity}
                    onChange={(e) => updateLine(idx, { quantity: Math.max(1, Number(e.target.value)) })}
                    className="num h-9 w-16 rounded-sm border border-border bg-surface px-2 text-sm text-text"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={l.unitPrice}
                    onChange={(e) => updateLine(idx, { unitPrice: Math.max(0, Number(e.target.value)) })}
                    className="num h-9 w-24 rounded-sm border border-border bg-surface px-2 text-sm text-text"
                  />
                  <Button type="button" variant="ghost" onClick={() => removeLine(idx)}>
                    Remove
                  </Button>
                </div>
              ))}
              <p className="num text-right text-sm font-semibold text-text">Total: ৳{total.toFixed(2)}</p>
            </div>
          )}
        </Card>

        <Card className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-text">Payment</h3>
          <div className="flex flex-wrap gap-4">
            {PAYMENT_PROVIDERS.map((p) => (
              <label key={p} className="flex items-center gap-2 text-sm text-text">
                <input type="radio" name="paymentProvider" checked={paymentProvider === p} onChange={() => setPaymentProvider(p)} />
                {p}
              </label>
            ))}
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Note (optional)</span>
            <textarea
              value={customerNote}
              onChange={(e) => setCustomerNote(e.target.value)}
              rows={2}
              className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand-500"
            />
          </label>
        </Card>

        {create.error && <p className="text-sm text-danger">{create.error instanceof Error ? create.error.message : "Failed to create order"}</p>}

        <div className="flex gap-3">
          <Button type="submit" variant="primary" disabled={create.isPending || lines.length === 0}>
            {create.isPending ? "Creating…" : "Create order"}
          </Button>
          <Link href="/net-profit/orders">
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
