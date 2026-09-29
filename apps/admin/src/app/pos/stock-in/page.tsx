"use client";

import { useState } from "react";
import { Icon } from "@amader/admin-ui";
import { useToast } from "@/components/ToastProvider";
import { usePosCatalog, useStockPost } from "@/hooks/usePos";
import type { PosProduct } from "@/lib/pos-cart";
import { usePosContext } from "@/components/pos/PosContext";
import { useScanner } from "@/components/pos/useScanner";
import { LOW_STOCK } from "@/components/pos/ProductGrid";
import {
  PosSubPage,
  primaryBtn,
  productLabel,
} from "@/components/pos/PosSubPage";
import {
  Pager,
  Thumb,
  toolbarInput,
  usePaged,
} from "@/components/pos/PosTableKit";

interface Line {
  p: PosProduct;
  qty: string;
  cost: string;
}

type Filter = "all" | "low" | "out" | "picked";

const keyOf = (p: PosProduct) => `${p.productId}:${p.variantId ?? 0}`;
const qtyOk = (s: string) => Number(s) > 0 && Number.isInteger(Number(s));
const th = "px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500";
const cell =
  "h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-sm outline-none focus:border-[#1d7a46]";

// ponytail: no supplier picker — the Accounts parties list needs Accounts
// permissions a store user won't have; the note carries the supplier name.
/**
 * Every product at the store is listed; type a quantity on as many rows as
 * were received and save them as one stock-in. A scan adds 1 to its row.
 */
export default function StockInPage() {
  const { storeId } = usePosContext();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [lines, setLines] = useState<Record<string, Line>>({});
  const [note, setNote] = useState("");
  // Ticked rows for "set the same quantity on all of them".
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [bulkQty, setBulkQty] = useState("");
  const [bulkCost, setBulkCost] = useState("");
  const { data = [], isFetching } = usePosCatalog(
    storeId,
    q.trim(),
    undefined,
    "name",
  );
  // Untracked products (stock 9999) have no stock count to add to.
  const tracked = data.filter((p) => p.stock < 9999);
  const counts = {
    all: tracked.length,
    low: tracked.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK).length,
    out: tracked.filter((p) => p.stock <= 0).length,
    picked: Object.values(lines).filter((l) => l.qty.trim() !== "").length,
  };
  const rows =
    filter === "low"
      ? tracked.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK)
      : filter === "out"
        ? tracked.filter((p) => p.stock <= 0)
        : filter === "picked"
          ? tracked.filter((p) => lines[keyOf(p)]?.qty.trim())
          : tracked;
  const paged = usePaged(rows);
  const save = useStockPost<unknown, { id: number; number: string }>(
    "/admin/stock/stock-in",
  );

  const set = (p: PosProduct, patch: Partial<Line>) =>
    setLines((ls) => {
      const k = keyOf(p);
      const prev = ls[k] ?? { p, qty: "", cost: "" };
      return { ...ls, [k]: { ...prev, ...patch } };
    });

  useScanner((code) => {
    const hit = tracked.find((p) => p.barcode === code || p.sku === code);
    if (!hit) return setQ(code);
    set(hit, { qty: String((Number(lines[keyOf(hit)]?.qty) || 0) + 1) });
    setQ("");
    toast.push(`+1 ${productLabel(hit)}`, "success");
  });

  const chosen = Object.values(lines).filter((l) => l.qty.trim() !== "");
  const valid = chosen.length > 0 && chosen.every((l) => qtyOk(l.qty));
  const units = chosen.reduce((n, l) => n + (Number(l.qty) || 0), 0);
  const tick = (keys: string[], on: boolean) =>
    setTicked((t) => {
      const n = new Set(t);
      for (const k of keys) {
        if (on) n.add(k);
        else n.delete(k);
      }
      return n;
    });
  const pageKeys = paged.items.map(keyOf);
  const allOnPage = pageKeys.length > 0 && pageKeys.every((k) => ticked.has(k));
  const applyBulk = () => {
    const byKey = new Map(tracked.map((p) => [keyOf(p), p]));
    setLines((ls) => {
      const next = { ...ls };
      for (const k of ticked) {
        const p = byKey.get(k) ?? ls[k]?.p;
        if (!p) continue;
        const prev = next[k] ?? { p, qty: "", cost: "" };
        next[k] = {
          ...prev,
          qty: bulkQty,
          cost: bulkCost.trim() ? bulkCost : prev.cost,
        };
      }
      return next;
    });
    toast.push(`Qty ${bulkQty} set on ${ticked.size} product(s)`, "success");
    setTicked(new Set());
    setBulkQty("");
    setBulkCost("");
  };
  const pick = (f: Filter) => {
    setFilter(f);
    paged.setPage(1);
  };

  return (
    <PosSubPage title="Stock in" permission="pos.stock_in" wide>
      <div className="mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
            <div>
              <h2 className="text-lg font-extrabold">Receive stock</h2>
              <p className="text-xs text-gray-500">
                Type the quantity received on each row (or scan to add 1), or
                tick several products and set one quantity for all of them. Then
                save them together.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-5 py-3">
            {(
              [
                ["all", "All", "inventory_2"],
                ["low", `Low stock (≤${LOW_STOCK})`, "trending_down"],
                ["out", "Out of stock", "remove_shopping_cart"],
                ["picked", "Selected", "check_circle"],
              ] as const
            ).map(([f, label, icon]) => (
              <button
                key={f}
                onClick={() => pick(f)}
                className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold ${filter === f ? "border-[#1d7a46] bg-emerald-50 text-[#1d7a46]" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}
              >
                <Icon name={icon} size={17} />
                {label}
                <span
                  className={`rounded-full px-1.5 text-xs ${filter === f ? "bg-[#1d7a46] text-white" : "bg-gray-100"}`}
                >
                  {counts[f]}
                </span>
              </button>
            ))}
            <label className={`${toolbarInput} ml-auto w-full max-w-xs`}>
              <Icon name="search" size={18} className="text-gray-400" />
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  paged.setPage(1);
                }}
                placeholder="Search, or scan a barcode to add 1"
                lang="en"
                className="flex-1 bg-transparent outline-none"
              />
            </label>
          </div>
          {ticked.size > 0 && (
            <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-emerald-100 bg-emerald-50 px-5 py-3 text-sm shadow-sm">
              <span className="font-bold text-[#1d7a46]">
                {ticked.size} selected
              </span>
              <input
                value={bulkQty}
                onChange={(e) => setBulkQty(e.target.value)}
                inputMode="numeric"
                placeholder="Qty for each"
                aria-label="Quantity for each selected product"
                className={`${cell} w-32 ${bulkQty.trim() && !qtyOk(bulkQty) ? "border-red-400" : ""}`}
              />
              <input
                value={bulkCost}
                onChange={(e) => setBulkCost(e.target.value)}
                inputMode="decimal"
                placeholder="Unit cost (optional)"
                aria-label="Unit cost for each selected product"
                className={`${cell} w-40`}
              />
              <button
                className={primaryBtn}
                disabled={!qtyOk(bulkQty)}
                onClick={applyBulk}
              >
                Apply to selected
              </button>
              <button
                className="font-semibold text-gray-500 hover:text-gray-800"
                onClick={() => setTicked(new Set())}
              >
                Unselect all
              </button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="w-10 pl-5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#1d7a46]"
                      checked={allOnPage}
                      onChange={(e) => tick(pageKeys, e.target.checked)}
                      aria-label="Select all on this page"
                    />
                  </th>
                  <th className={`${th} pl-2`}>Product</th>
                  <th className={th}>In stock</th>
                  <th className={th}>Qty received</th>
                  <th className={th}>Unit cost (৳)</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-10 text-center text-gray-500"
                    >
                      {isFetching ? "Loading…" : "No products"}
                    </td>
                  </tr>
                )}
                {paged.items.map((p) => {
                  const l = lines[keyOf(p)];
                  const bad = !!l?.qty.trim() && !qtyOk(l.qty);
                  return (
                    <tr
                      key={keyOf(p)}
                      className={`border-t border-gray-100 ${l?.qty ? "bg-emerald-50/60" : "hover:bg-gray-50/60"}`}
                    >
                      <td className="pl-5">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[#1d7a46]"
                          checked={ticked.has(keyOf(p))}
                          onChange={(e) => tick([keyOf(p)], e.target.checked)}
                          aria-label={`Select ${productLabel(p)}`}
                        />
                      </td>
                      <td className="py-2 pl-2 pr-4">
                        <span className="flex items-center gap-3">
                          <Thumb url={p.imageUrl} />
                          <span className="min-w-0">
                            <span className="line-clamp-2 font-semibold text-gray-900">
                              {productLabel(p)}
                            </span>
                            {p.sku && (
                              <span className="font-mono text-xs text-gray-400">
                                {p.sku}
                              </span>
                            )}
                          </span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4">
                        <StockPill n={p.stock} />
                      </td>
                      <td className="px-4">
                        <input
                          value={l?.qty ?? ""}
                          onChange={(e) => set(p, { qty: e.target.value })}
                          inputMode="numeric"
                          placeholder="0"
                          aria-label={`Qty received for ${productLabel(p)}`}
                          className={`${cell} w-24 ${bad ? "border-red-400" : ""}`}
                        />
                      </td>
                      <td className="px-4">
                        <input
                          value={l?.cost ?? ""}
                          onChange={(e) => set(p, { cost: e.target.value })}
                          inputMode="decimal"
                          placeholder="optional"
                          aria-label={`Unit cost for ${productLabel(p)}`}
                          className={`${cell} w-28`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager {...paged} noun="products" />
          <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-gray-200 bg-white px-5 py-3">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (optional) — e.g. supplier name and invoice no."
              className={`${cell} h-10 min-w-[260px] flex-1`}
            />
            <span className="text-sm text-gray-600">
              <b>{chosen.length}</b> product(s), <b>{units}</b> unit(s)
            </span>
            {chosen.length > 0 && (
              <button
                className="text-sm font-semibold text-gray-500 hover:text-red-600"
                onClick={() => setLines({})}
              >
                Clear all
              </button>
            )}
            <button
              className={primaryBtn}
              disabled={!valid || save.isPending}
              onClick={() =>
                save.mutate(
                  {
                    storeId,
                    note: note.trim() || undefined,
                    lines: chosen.map((l) => ({
                      productId: l.p.productId,
                      variantId: l.p.variantId ?? undefined,
                      qty: Number(l.qty),
                      unitCost: l.cost ? Number(l.cost) : undefined,
                    })),
                  },
                  {
                    onSuccess: (r) => {
                      toast.push(`${r.number} saved`, "success");
                      setLines({});
                      setNote("");
                    },
                    onError: (e) => toast.push(e.message),
                  },
                )
              }
            >
              {save.isPending ? "Saving…" : "Save stock-in"}
            </button>
          </div>
        </div>
      </div>
    </PosSubPage>
  );
}

function StockPill({ n }: { n: number }) {
  const tone =
    n <= 0
      ? "bg-red-50 text-red-700"
      : n <= LOW_STOCK
        ? "bg-amber-50 text-amber-800"
        : "bg-emerald-50 text-[#1d7a46]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {n}
    </span>
  );
}
