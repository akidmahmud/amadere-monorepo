"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@amader/admin-ui";
import { useToast } from "@/components/ToastProvider";
import { proxyFetch } from "@/lib/api/proxy-client";
import {
  quickAddCustomer,
  searchPosCustomers,
  useCompleteSale,
  type PosCustomer,
} from "@/hooks/usePos";
import {
  cartCount,
  taka,
  unitPrice,
  parseQtyInput,
  type CartAction,
  type CartLine,
} from "@/lib/pos-cart";

type Tender = "CASH" | "CARD" | "MOBILE";
interface Quote {
  subTotal: string;
  discount: string;
  vat: string;
  total: string;
  vatOnTop: boolean;
  vatRatePercent: number;
}

/** Server-priced totals (VAT exemptions, coupon) for the current cart. */
function useQuote(
  storeId: number | undefined,
  cart: CartLine[],
  customerId: number | undefined,
  couponCode: string,
) {
  const items = cart.map((l) => ({
    productId: l.productId,
    variantId: l.variantId ?? undefined,
    quantity: l.qty,
  }));
  return useQuery({
    queryKey: [
      "pos-quote",
      storeId,
      JSON.stringify(items),
      customerId,
      couponCode,
    ],
    queryFn: () =>
      proxyFetch<Quote>("/admin/pos/quote", {
        method: "POST",
        body: JSON.stringify({
          storeId,
          items,
          customerId,
          couponCode: couponCode || undefined,
        }),
      }),
    enabled: cart.length > 0,
    retry: false,
    placeholderData: (prev) => prev,
  });
}

export function CartPanel({
  cart,
  dispatch,
  storeId,
  customer,
  onCustomer,
  heldSaleId,
  onDone,
}: {
  cart: CartLine[];
  dispatch: (a: CartAction) => void;
  storeId: number | undefined;
  customer: PosCustomer | null;
  onCustomer: (c: PosCustomer | null) => void;
  heldSaleId?: number;
  onDone: () => void;
}) {
  const toast = useToast();
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState("");
  const [tender, setTender] = useState<Tender>("CASH");
  const [cashIn, setCashIn] = useState("");
  const [trxRef, setTrxRef] = useState("");
  const sale = useCompleteSale();
  const quote = useQuote(storeId, cart, customer?.id, coupon);

  // Check a code with the server before keeping it, so a bad code never
  // blocks the sale.
  const [checking, setChecking] = useState(false);
  const applyCoupon = async () => {
    const code = couponInput.trim();
    setChecking(true);
    try {
      await proxyFetch<Quote>("/admin/pos/quote", {
        method: "POST",
        body: JSON.stringify({
          storeId,
          items: cart.map((l) => ({
            productId: l.productId,
            variantId: l.variantId ?? undefined,
            quantity: l.qty,
          })),
          customerId: customer?.id,
          couponCode: code,
        }),
      });
      setCoupon(code);
    } catch (e) {
      toast.push((e as Error).message);
    } finally {
      setChecking(false);
    }
  };

  const subtotal = useMemo(
    () => cart.reduce((s, l) => s + unitPrice(l) * l.qty, 0),
    [cart],
  );
  const q = cart.length ? quote.data : undefined;
  const total = Number(q?.total ?? 0);
  const change = tender === "CASH" && cashIn ? Number(cashIn) - total : 0;
  const ready =
    cart.length > 0 &&
    !!q &&
    !quote.isFetching &&
    !sale.isPending &&
    (tender !== "CASH" || !cashIn || change >= 0);

  const complete = () => {
    sale.mutate(
      {
        storeId,
        items: cart.map((l) => ({
          productId: l.productId,
          variantId: l.variantId ?? undefined,
          quantity: l.qty,
        })),
        customerId: customer?.id,
        couponCode: coupon || undefined,
        tender,
        tenderedAmount:
          tender === "CASH" && cashIn ? Number(cashIn) : undefined,
        transactionRef: tender !== "CASH" ? trxRef || undefined : undefined,
        heldSaleId,
      },
      {
        onSuccess: (r) => {
          toast.push(
            `Sale ${r.orderNumber} done${Number(r.change) > 0 ? ` — change ${taka(r.change)}` : ""}`,
            "success",
          );
          window.open(`/pos/receipt/${r.orderId}`, "_blank", "noopener");
          setCoupon("");
          setCouponInput("");
          setCashIn("");
          setTrxRef("");
          setTender("CASH");
          onDone();
        },
        onError: (e) => toast.push(e.message),
      },
    );
  };

  return (
    <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm lg:w-[440px]">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <Icon name="shopping_cart" size={26} className="text-[#1d7a46]" />
          <span className="text-lg font-extrabold">Current Sale</span>
          <span className="grid h-7 min-w-7 place-items-center rounded-full bg-emerald-50 px-2 text-sm font-bold text-[#1d7a46]">
            {cart.length}
          </span>
        </div>
        <button
          onClick={() => dispatch({ type: "clear" })}
          disabled={!cart.length}
          className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 disabled:opacity-40"
        >
          <Icon name="delete" size={18} /> Clear Cart
        </button>
      </div>

      <div className="min-h-[120px] flex-1 overflow-y-auto">
        {cart.length === 0 && (
          <div className="grid h-full place-items-center p-8 text-center text-sm text-gray-500">
            Scan a barcode or tap Add on a product
          </div>
        )}
        {cart.map((l) => (
          <div
            key={l.key}
            className="flex items-center gap-3 border-b border-gray-100 px-5 py-3"
          >
            <div className="grid h-14 w-14 shrink-0 place-items-center">
              {l.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={l.imageUrl}
                  alt=""
                  className="max-h-14 max-w-full object-contain"
                />
              ) : (
                <Icon name="image" size={28} className="text-gray-300" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">
                {l.name}
                {l.variantLabel ? ` ${l.variantLabel}` : ""}
              </div>
              <div className="text-sm font-bold">{taka(unitPrice(l))}</div>
            </div>
            <div className="flex items-center rounded-lg border border-gray-200">
              <button
                className="grid h-9 w-9 place-items-center"
                onClick={() =>
                  dispatch({ type: "setQty", key: l.key, qty: l.qty - 1 })
                }
                aria-label="Less"
              >
                <Icon name="remove" size={18} />
              </button>
              <QtyInput
                qty={l.qty}
                onQty={(qty) => dispatch({ type: "setQty", key: l.key, qty })}
              />
              <button
                className="grid h-9 w-9 place-items-center disabled:opacity-30"
                disabled={l.qty >= l.stock}
                onClick={() =>
                  dispatch({ type: "setQty", key: l.key, qty: l.qty + 1 })
                }
                aria-label="More"
              >
                <Icon name="add" size={18} />
              </button>
            </div>
            <div className="w-16 text-right text-sm font-bold">
              {taka(unitPrice(l) * l.qty)}
            </div>
            <button
              className="text-gray-400 hover:text-red-500"
              onClick={() => dispatch({ type: "remove", key: l.key })}
              aria-label="Remove"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-3 border-t border-gray-100 px-5 py-4">
        <CustomerPicker customer={customer} onCustomer={onCustomer} />

        <div className="flex items-center gap-2">
          <span className="flex shrink-0 items-center gap-2 text-sm font-semibold">
            <Icon name="sell" size={20} className="text-[#1d7a46]" /> Discount /
            Coupon
          </span>
          <input
            value={couponInput}
            onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
            placeholder="Enter code..."
            lang="en"
            className="h-10 min-w-0 flex-1 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#1d7a46]"
          />
          <button
            onClick={applyCoupon}
            disabled={!couponInput.trim() || !cart.length || checking}
            className="h-10 rounded-lg bg-emerald-50 px-4 text-sm font-bold text-[#1d7a46] disabled:opacity-40"
          >
            Apply
          </button>
        </div>

        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-600">
              Subtotal ({cartCount(cart)} items)
            </dt>
            <dd>{taka(q?.subTotal ?? subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">
              Discount{coupon ? ` (${coupon})` : ""}
            </dt>
            <dd>{taka(q?.discount ?? 0)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">
              {q
                ? `${q.vatOnTop ? "" : "incl. "}VAT ${q.vatRatePercent}%`
                : "VAT"}
            </dt>
            <dd>{taka(q?.vat ?? 0)}</dd>
          </div>
        </dl>

        {cart.length > 0 && quote.error && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            <span>{quote.error.message}</span>
            {coupon && (
              <button
                className="shrink-0 underline"
                onClick={() => setCoupon("")}
              >
                Remove coupon
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3.5">
          <span className="text-lg font-extrabold">Total Amount</span>
          <span className="text-xl font-extrabold">{taka(total)}</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["CASH", "Cash", "payments"],
              ["CARD", "Card", "credit_card"],
              ["MOBILE", "Mobile Banking", "smartphone"],
            ] as const
          ).map(([t, label, icon]) => (
            <button
              key={t}
              onClick={() => setTender(t)}
              className={`flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-semibold ${
                tender === t
                  ? "border-[#1d7a46] bg-[#1d7a46] text-white"
                  : "border-gray-200 bg-white text-gray-800"
              }`}
            >
              <Icon name={icon} size={20} /> {label}
            </button>
          ))}
        </div>

        {tender === "CASH" ? (
          <div className="flex items-center gap-3 text-sm">
            <label className="flex flex-1 items-center gap-2">
              <span className="shrink-0 text-gray-600">Cash received</span>
              <input
                value={cashIn}
                onChange={(e) =>
                  setCashIn(e.target.value.replace(/[^\d.]/g, ""))
                }
                inputMode="decimal"
                placeholder={total ? String(total) : "0"}
                className="h-10 min-w-0 flex-1 rounded-lg border border-gray-200 px-3 outline-none focus:border-[#1d7a46]"
              />
            </label>
            <span
              className={`shrink-0 font-bold ${change < 0 ? "text-red-600" : "text-gray-800"}`}
            >
              {change < 0 ? `Short ${taka(-change)}` : `Change ${taka(change)}`}
            </span>
          </div>
        ) : (
          <input
            value={trxRef}
            onChange={(e) => setTrxRef(e.target.value)}
            placeholder={
              tender === "CARD"
                ? "Card slip no. (optional)"
                : "bKash / Nagad TrxID"
            }
            lang="en"
            className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#1d7a46]"
          />
        )}

        <button
          onClick={complete}
          disabled={!ready}
          className="flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-[#1d7a46] text-lg font-extrabold text-white hover:bg-[#186a3c] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="lock" size={22} />{" "}
          {sale.isPending ? "Saving…" : `Complete Sale ${taka(total)}`}
          <Icon name="arrow_forward" size={22} />
        </button>
      </div>
    </aside>
  );
}

function CustomerPicker({
  customer,
  onCustomer,
}: {
  customer: PosCustomer | null;
  onCustomer: (c: PosCustomer | null) => void;
}) {
  const toast = useToast();
  const [term, setTerm] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 250);
    return () => clearTimeout(t);
  }, [term]);
  const results = useQuery({
    queryKey: ["pos-customers", debounced],
    queryFn: () => searchPosCustomers(debounced),
    enabled: debounced.length >= 2 && !customer,
  });

  if (customer) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
        <span className="flex items-center gap-2">
          <Icon name="person" size={20} className="text-[#1d7a46]" />
          <b>{customer.name}</b>{" "}
          <span className="text-gray-600">{customer.phone}</span>
        </span>
        <button
          onClick={() => onCustomer(null)}
          aria-label="Remove customer"
          className="text-gray-500"
        >
          <Icon name="close" size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Icon name="person" size={20} className="text-[#1d7a46]" /> Customer{" "}
          <span className="font-normal text-gray-500">(Optional)</span>
        </span>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold"
        >
          <Icon name="add" size={16} /> Add Customer
        </button>
      </div>
      <div className="relative">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={
            adding ? "Phone number" : "Search by name, phone or ID..."
          }
          lang="en"
          className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#1d7a46]"
        />
        {!adding && !!results.data?.length && (
          <div className="absolute inset-x-0 top-11 z-20 rounded-xl border border-gray-200 bg-white shadow-lg">
            {results.data.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onCustomer(c);
                  setTerm("");
                }}
                className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <span className="font-semibold">{c.name}</span>
                <span className="text-gray-500">{c.phone}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {adding && (
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (optional)"
            className="h-10 min-w-0 flex-1 rounded-lg border border-gray-200 px-3 text-sm outline-none"
          />
          <button
            className="h-10 rounded-lg bg-[#1d7a46] px-4 text-sm font-bold text-white"
            onClick={async () => {
              try {
                onCustomer(
                  await quickAddCustomer(term.trim(), name.trim() || undefined),
                );
                setAdding(false);
                setTerm("");
                setName("");
              } catch (e) {
                toast.push((e as Error).message);
              }
            }}
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}

/** Local text so the box can be cleared and retyped; commits valid digits, snaps back on blur. */
function QtyInput({ qty, onQty }: { qty: number; onQty: (q: number) => void }) {
  const [text, setText] = useState(String(qty));
  const [focused, setFocused] = useState(false);
  // Follow +/−/stock caps while not being typed in (no remount: that stole focus mid-typing).
  if (!focused && text !== String(qty)) setText(String(qty));
  return (
    <input
      value={text}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        setText(e.target.value);
        const next = parseQtyInput(e.target.value, qty);
        if (next !== qty) onQty(next);
      }}
      onBlur={() => {
        setFocused(false);
        setText(String(qty));
      }}
      inputMode="numeric"
      className="h-9 w-10 border-x border-gray-200 text-center text-sm outline-none"
      aria-label="Quantity"
    />
  );
}
