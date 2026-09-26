"use client";

import { useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { usePosCatalog, useStockPost } from "@/hooks/usePos";
import type { PosProduct } from "@/lib/pos-cart";
import { usePosContext } from "@/components/pos/PosContext";
import { useScanner } from "@/components/pos/useScanner";
import {
  PosSubPage,
  card,
  input,
  primaryBtn,
  productLabel,
} from "@/components/pos/PosSubPage";

interface Line {
  p: PosProduct;
  qty: string;
  cost: string;
}

const keyOf = (p: PosProduct) => `${p.productId}:${p.variantId ?? 0}`;
const qtyOk = (s: string) => Number(s) > 0 && Number.isInteger(Number(s));

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
  const [lines, setLines] = useState<Record<string, Line>>({});
  const [note, setNote] = useState("");
  const { data = [], isFetching } = usePosCatalog(
    storeId,
    q.trim(),
    undefined,
    "name",
  );
  // Untracked products (stock 9999) have no stock count to add to.
  const rows = data.filter((p) => p.stock < 9999);
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
    const hit = rows.find((p) => p.barcode === code || p.sku === code);
    if (!hit) return setQ(code);
    set(hit, { qty: String((Number(lines[keyOf(hit)]?.qty) || 0) + 1) });
    setQ("");
    toast.push(`+1 ${productLabel(hit)}`, "success");
  });

  const chosen = Object.values(lines).filter((l) => l.qty.trim() !== "");
  const valid = chosen.length > 0 && chosen.every((l) => qtyOk(l.qty));
  const units = chosen.reduce((n, l) => n + (Number(l.qty) || 0), 0);

  return (
    <PosSubPage title="Stock in" permission="pos.stock_in">
      <div className={`${card} space-y-4`}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter products, or scan a barcode to add 1…"
          lang="en"
          className={`${input} w-full`}
        />
        <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-3 py-2">Product</th>
                <th className="w-24">In stock</th>
                <th className="w-28">Qty received</th>
                <th className="w-32">Unit cost (৳)</th>
              </tr>
            </thead>
            <tbody>
              {isFetching && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-6 text-center text-gray-500"
                  >
                    Loading…
                  </td>
                </tr>
              )}
              {!isFetching && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-6 text-center text-gray-500"
                  >
                    No products
                  </td>
                </tr>
              )}
              {rows.map((p) => {
                const l = lines[keyOf(p)];
                const bad = !!l?.qty.trim() && !qtyOk(l.qty);
                return (
                  <tr
                    key={keyOf(p)}
                    className={`border-t border-gray-100 ${l?.qty ? "bg-emerald-50" : ""}`}
                  >
                    <td className="px-3 py-1.5">
                      {productLabel(p)}
                      <span className="ml-2 text-xs text-gray-400">
                        {p.sku}
                      </span>
                    </td>
                    <td className="text-gray-600">{p.stock}</td>
                    <td>
                      <input
                        value={l?.qty ?? ""}
                        onChange={(e) => set(p, { qty: e.target.value })}
                        inputMode="numeric"
                        placeholder="0"
                        aria-label={`Qty received for ${productLabel(p)}`}
                        className={`${input} h-9 w-24 ${bad ? "border-red-400" : ""}`}
                      />
                    </td>
                    <td>
                      <input
                        value={l?.cost ?? ""}
                        onChange={(e) => set(p, { cost: e.target.value })}
                        inputMode="decimal"
                        placeholder="optional"
                        aria-label={`Unit cost for ${productLabel(p)}`}
                        className={`${input} h-9 w-28`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional) — e.g. supplier name and their invoice no."
          className={`${input} w-full`}
        />
        <div className="flex flex-wrap items-center gap-3">
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
          <span className="text-sm text-gray-600">
            {chosen.length} product(s), {units} unit(s)
          </span>
          {chosen.length > 0 && (
            <button
              className="text-sm font-semibold text-gray-500 hover:text-red-600"
              onClick={() => setLines({})}
            >
              Clear all
            </button>
          )}
        </div>
      </div>
    </PosSubPage>
  );
}
