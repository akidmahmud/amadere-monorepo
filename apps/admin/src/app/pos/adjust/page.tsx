"use client";

import { useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { useMovements, useStockPost } from "@/hooks/usePos";
import type { PosProduct } from "@/lib/pos-cart";
import { usePosContext } from "@/components/pos/PosContext";
import {
  PosSubPage,
  ProductPicker,
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

  const n = Number(qty);
  const valid =
    !!p && n > 0 && Number.isInteger(n) && (reason !== "OTHER" || note.trim());

  return (
    <PosSubPage title="Adjust stock" permission="pos.adjust">
      <div className={`${card} space-y-4`}>
        <ProductPicker onPick={setP} />
        {p && (
          <>
            <div className="text-sm">
              <b>{productLabel(p)}</b> — current stock at this store:{" "}
              <b>{p.stock}</b>
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
