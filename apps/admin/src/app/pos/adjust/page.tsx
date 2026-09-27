"use client";

import { useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { useMovements, usePosCatalog, useStockPost } from "@/hooks/usePos";
import { useScanner } from "@/components/pos/useScanner";
import type { PosProduct } from "@/lib/pos-cart";
import { usePosContext } from "@/components/pos/PosContext";
import {
  PosSubPage,
  card,
  input,
  primaryBtn,
  productLabel,
} from "@/components/pos/PosSubPage";

const REASONS = [
  ["DAMAGED", "Damaged"],
  ["EXPIRED", "Expired"],
  ["COUNT_CORRECTION", "Count correction"],
  ["LOST", "Lost"],
  ["OTHER", "Other"],
] as const;

const TYPE_LABEL: Record<string, string> = {
  OPENING: "Opening",
  SALE: "Sale",
  RETURN: "Return",
  STOCK_IN: "Stock in",
  ADJUSTMENT: "Adjustment",
  TRANSFER_OUT: "Transfer out",
  TRANSFER_IN: "Transfer in",
};

export default function AdjustPage() {
  const { storeId } = usePosContext();
  const toast = useToast();
  const [p, setP] = useState<PosProduct | null>(null);
  const [dir, setDir] = useState<1 | -1>(-1);
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState<(typeof REASONS)[number][0]>("DAMAGED");
  const [note, setNote] = useState("");
  const save = useStockPost("/admin/stock/adjust");
  const moves = useMovements(p?.productId, p?.variantId, storeId);
  const [q, setQ] = useState("");
  const { data = [], isFetching } = usePosCatalog(
    storeId,
    q.trim(),
    undefined,
    "name",
  );
  // Untracked products (stock 9999) have no count to adjust.
  const rows = data.filter((r) => r.stock < 9999);
  useScanner((code) => {
    const hit = rows.find((r) => r.barcode === code || r.sku === code);
    if (hit) {
      setP(hit);
      setQ("");
    } else setQ(code);
  });

  const n = Number(qty);
  const valid =
    !!p && n > 0 && Number.isInteger(n) && (reason !== "OTHER" || note.trim());

  return (
    <PosSubPage title="Adjust stock" permission="pos.adjust">
      <div className={`${card} space-y-4`}>
        {!p && (
          <>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter products, or scan a barcode…"
              lang="en"
              className={`${input} w-full`}
            />
            <div className="max-h-[65vh] overflow-y-auto rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 text-left text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Product</th>
                    <th className="w-24">In stock</th>
                    <th className="w-28" />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-3 py-6 text-center text-gray-500"
                      >
                        {isFetching ? "Loading…" : "No products"}
                      </td>
                    </tr>
                  )}
                  {rows.map((r) => (
                    <tr
                      key={`${r.productId}:${r.variantId ?? 0}`}
                      className="cursor-pointer border-t border-gray-100 hover:bg-emerald-50"
                      onClick={() => setP(r)}
                    >
                      <td className="px-3 py-2">
                        {productLabel(r)}
                        <span className="ml-2 text-xs text-gray-400">
                          {r.sku}
                        </span>
                      </td>
                      <td
                        className={
                          r.stock <= 0 ? "text-red-600" : "text-gray-700"
                        }
                      >
                        {r.stock}
                      </td>
                      <td className="pr-3 text-right">
                        <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-[#1d7a46]">
                          Adjust
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {p && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                <b>{productLabel(p)}</b> — current stock at this store:{" "}
                <b>{p.stock}</b>
              </span>
              <button
                className="font-semibold text-[#1d7a46] hover:underline"
                onClick={() => setP(null)}
              >
                ← Change product
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex overflow-hidden rounded-lg border border-gray-200">
                {(
                  [
                    [-1, "Remove"],
                    [1, "Add"],
                  ] as const
                ).map(([d, label]) => (
                  <button
                    key={d}
                    onClick={() => setDir(d)}
                    className={`h-10 px-4 text-sm font-semibold ${dir === d ? "bg-[#1d7a46] text-white" : "bg-white"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                inputMode="numeric"
                className={`${input} w-24`}
                aria-label="Quantity"
              />
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as typeof reason)}
                className={input}
                aria-label="Reason"
              >
                {REASONS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                reason === "OTHER"
                  ? "Note (required for Other)"
                  : "Note (optional)"
              }
              className={`${input} w-full`}
            />
            <button
              className={primaryBtn}
              disabled={!valid || save.isPending}
              onClick={() =>
                save.mutate(
                  {
                    storeId,
                    productId: p.productId,
                    variantId: p.variantId ?? undefined,
                    qty: dir * n,
                    reason,
                    note: note.trim() || undefined,
                  },
                  {
                    onSuccess: () => {
                      toast.push("Stock adjusted", "success");
                      setP({ ...p, stock: p.stock + dir * n });
                      setQty("1");
                      setNote("");
                    },
                    onError: (e) => toast.push(e.message),
                  },
                )
              }
            >
              {save.isPending ? "Saving…" : "Save adjustment"}
            </button>
          </>
        )}
      </div>

      {p && (
        <div className={`${card} mt-5`}>
          <h2 className="mb-3 font-bold">Recent movements</h2>
          {!moves.data?.length && (
            <div className="text-sm text-gray-500">
              None recorded at this store yet.
            </div>
          )}
          <table className="w-full text-sm">
            <tbody>
              {moves.data?.map((m) => (
                <tr key={m.id} className="border-t border-gray-100">
                  <td className="py-2 text-gray-500">
                    {new Date(m.createdAt).toLocaleString("en-GB")}
                  </td>
                  <td>{TYPE_LABEL[m.type] ?? m.type}</td>
                  <td
                    className={`text-right font-semibold ${m.qty < 0 ? "text-red-600" : "text-emerald-700"}`}
                  >
                    {m.qty > 0 ? `+${m.qty}` : m.qty}
                  </td>
                  <td className="pl-4 text-gray-500">{m.reason ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PosSubPage>
  );
}
