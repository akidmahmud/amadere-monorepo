"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@amader/admin-ui";
import { useToast } from "@/components/ToastProvider";
import { proxyFetch } from "@/lib/api/proxy-client";
import {
  quickAddCustomer,
  useTillCoupons,
  searchPosCustomers,
  useCompleteSale,
  type PosCustomer,
} from "@/hooks/usePos";
import {
  cartCount,
  taka,
  unitPrice,
  parseQtyInput,
  normalizeBdPhone,
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
  const [draft, setDraft] = useState<CustomerDraft>({ phone: null, name: "" });
  const [saleCount, setSaleCount] = useState(0);
  const [showCoupons, setShowCoupons] = useState(false);
  const sale = useCompleteSale();
  const quote = useQuote(storeId, cart, customer?.id, coupon);

  // Check a code with the server before keeping it, so a bad code never
  // blocks the sale.
  const [checking, setChecking] = useState(false);
  const applyCoupon = async (picked?: string) => {
    const code = (picked ?? couponInput).trim();
    if (!cart.length) return toast.push("Add items to the cart first");
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
        // Typed a phone but didn't pick anyone: the sale finds or creates them.
        customerPhone: !customer && draft.phone ? draft.phone : undefined,
        customerName:
          !customer && draft.phone && draft.name.trim()
            ? draft.name.trim()
            : undefined,
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
          setDraft({ phone: null, name: "" });
          setSaleCount((n) => n + 1);
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
        <CustomerPicker
          key={saleCount}
          customer={customer}
          onCustomer={onCustomer}
          onDraft={setDraft}
        />

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
            onClick={() => void applyCoupon()}
            disabled={!couponInput.trim() || !cart.length || checking}
            className="h-10 rounded-lg bg-emerald-50 px-4 text-sm font-bold text-[#1d7a46] disabled:opacity-40"
          >
            Apply
          </button>
          <button
            onClick={() => setShowCoupons((v) => !v)}
            aria-label="View coupons"
            title="View coupons"
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border ${showCoupons ? "border-[#1d7a46] bg-emerald-50 text-[#1d7a46]" : "border-gray-200 text-gray-700"}`}
          >
            <Icon name="confirmation_number" size={20} />
          </button>
        </div>
        {showCoupons && (
          <TillCouponList
            storeId={storeId}
            subtotal={subtotal}
            onPick={(code) => {
              setCouponInput(code);
              setShowCoupons(false);
              void applyCoupon(code);
            }}
          />
        )}

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

/** A phone typed but not picked yet — sent with the sale, which finds or creates the customer. */
export interface CustomerDraft {
  phone: string | null;
  name: string;
}

function CustomerPicker({
  customer,
  onCustomer,
  onDraft,
}: {
  customer: PosCustomer | null;
  onCustomer: (c: PosCustomer | null) => void;
  onDraft: (d: CustomerDraft) => void;
}) {
  const toast = useToast();
  const [term, setTerm] = useState("");
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
  const phone = normalizeBdPhone(term);
  const exact = phone
    ? results.data?.find((c) => c.phone && normalizeBdPhone(c.phone) === phone)
    : undefined;
  const isNew =
    !!phone && !exact && results.isFetched && debounced === term.trim();

  const pick = (c: PosCustomer) => {
    onCustomer(c);
    setTerm("");
    setName("");
    onDraft({ phone: null, name: "" });
  };
  const setDraft = (t: string, n: string) =>
    onDraft({ phone: normalizeBdPhone(t), name: n });
  const createNow = async () => {
    if (!phone) return;
    try {
      pick(await quickAddCustomer(phone, name.trim() || undefined));
    } catch (e) {
      toast.push((e as Error).message);
    }
  };

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
      <span className="flex items-center gap-2 text-sm font-semibold">
        <Icon name="person" size={20} className="text-[#1d7a46]" /> Customer{" "}
        <span className="font-normal text-gray-500">
          (Optional — type a phone number)
        </span>
      </span>
      <div className="relative">
        <input
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setDraft(e.target.value, name);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            if (exact) pick(exact);
            else if (phone) void createNow();
          }}
          placeholder="Phone number or name..."
          lang="en"
          inputMode="tel"
          aria-label="Customer phone or name"
          className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#1d7a46]"
        />
        {/* Existing matches float over the panel; the new-customer row below stays in the flow so nothing covers it. */}
        {!!results.data?.length && term.trim().length >= 2 && (
          <div className="absolute inset-x-0 top-11 z-20 rounded-xl border border-gray-200 bg-white shadow-lg">
            {results.data.map((c) => (
              <button
                key={c.id}
                onClick={() => pick(c)}
                className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <span className="font-semibold">{c.name}</span>
                <span className="text-gray-500">{c.phone}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {phone && !exact && (
        <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#1d7a46]">
            <Icon name="person_add" size={18} /> New customer: {phone}
          </div>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setDraft(term, e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void createNow();
              }}
              placeholder="Name (optional)"
              aria-label="New customer name"
              className="h-10 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#1d7a46]"
            />
            <button
              onClick={() => void createNow()}
              disabled={!phone}
              className="h-10 shrink-0 rounded-lg bg-[#1d7a46] px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              Add
            </button>
          </div>
          <p className="text-[11px] text-emerald-900/70">
            Or just complete the sale — the customer is saved with it.
          </p>
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

/** Coupons usable at this store now; tap one to apply it. */
function TillCouponList({
  storeId,
  subtotal,
  onPick,
}: {
  storeId: number | undefined;
  subtotal: number;
  onPick: (code: string) => void;
}) {
  const { data = [], isLoading } = useTillCoupons(storeId, true);
  const SCOPE = {
    store: "This store",
    pos: "All stores",
    all: "Website + POS",
  } as const;
  return (
    <div className="max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white">
      {isLoading && (
        <div className="px-3 py-3 text-sm text-gray-500">Loading coupons…</div>
      )}
      {!isLoading && data.length === 0 && (
        <div className="px-3 py-3 text-sm text-gray-500">
          No coupons available at this store right now.
        </div>
      )}
      {data.map((c) => {
        const short =
          c.minOrderAmount !== null && subtotal < Number(c.minOrderAmount);
        return (
          <button
            key={c.code}
            onClick={() => onPick(c.code)}
            className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-emerald-50"
          >
            <span className="min-w-0">
              <span className="font-mono font-bold">{c.code}</span>
              <span className="ml-2 font-semibold text-[#1d7a46]">
                {c.valueType === "PERCENTAGE"
                  ? `${Number(c.value)}% off`
                  : `${taka(c.value)} off`}
              </span>
              <span className="block text-xs text-gray-500">
                {SCOPE[c.scope]}
                {c.minOrderAmount ? ` · min ${taka(c.minOrderAmount)}` : ""}
                {c.endsAt
                  ? ` · until ${new Date(c.endsAt).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" })}`
                  : ""}
              </span>
            </span>
            {short && (
              <span className="shrink-0 text-[11px] font-semibold text-amber-700">
                Needs more
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
