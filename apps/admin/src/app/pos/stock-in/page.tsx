"use client";

import { useState } from "react";
import { Icon } from "@amader/admin-ui";
import { useToast } from "@/components/ToastProvider";
import { useStockPost } from "@/hooks/usePos";
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

interface Line {
  p: PosProduct;
  qty: string;
  cost: string;
}

// ponytail: no supplier picker — the Accounts parties list needs Accounts
// permissions a store user won't have; the note carries the supplier name.
export default function StockInPage() {
  const { storeId } = usePosContext();
  const toast = useToast();
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState("");
  const save = useStockPost<unknown, { id: number; number: string }>(
    "/admin/stock/stock-in",
  );

  const add = (p: PosProduct) =>
    setLines((ls) =>
      ls.some(
        (l) => l.p.productId === p.productId && l.p.variantId === p.variantId,
      )
        ? ls
        : [...ls, { p, qty: "1", cost: "" }],
    );
  const set = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const valid =
    lines.length > 0 &&
    lines.every((l) => Number(l.qty) > 0 && Number.isInteger(Number(l.qty)));

  return (
    <PosSubPage title="Stock in" permission="pos.stock_in">
      <div className={`${card} space-y-4`}>
        <ProductPicker
          onPick={add}
          placeholder="Scan or search products received…"
        />
        {lines.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="py-2">Product</th>
                <th className="w-28">Qty received</th>
                <th className="w-32">Unit cost (৳)</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr
                  key={`${l.p.productId}:${l.p.variantId ?? 0}`}
                  className="border-t border-gray-100"
                >
                  <td className="py-2">
                    {productLabel(l.p)}{" "}
                    <span className="text-xs text-gray-400">
                      now {l.p.stock}
                    </span>
                  </td>
                  <td>
                    <input
                      value={l.qty}
                      onChange={(e) => set(i, { qty: e.target.value })}
                      inputMode="numeric"
                      className={`${input} w-24`}
                    />
                  </td>
                  <td>
                    <input
                      value={l.cost}
                      onChange={(e) => set(i, { cost: e.target.value })}
                      inputMode="decimal"
                      placeholder="optional"
                      className={`${input} w-28`}
                    />
                  </td>
                  <td>
                    <button
                      onClick={() =>
                        setLines((ls) => ls.filter((_, j) => j !== i))
                      }
                      aria-label="Remove"
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Icon name="close" size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Supplier / invoice no. / note"
          className={`${input} w-full`}
        />
        <button
          className={primaryBtn}
          disabled={!valid || save.isPending}
          onClick={() =>
            save.mutate(
              {
                storeId,
                note: note.trim() || undefined,
                lines: lines.map((l) => ({
                  productId: l.p.productId,
                  variantId: l.p.variantId ?? undefined,
                  qty: Number(l.qty),
                  unitCost: l.cost ? Number(l.cost) : undefined,
                })),
              },
              {
                onSuccess: (r) => {
                  toast.push(`${r.number} saved`, "success");
                  setLines([]);
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
    </PosSubPage>
  );
}
