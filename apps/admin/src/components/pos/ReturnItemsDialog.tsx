"use client";

import { useState } from "react";
import { Icon } from "@amader/admin-ui";
import { useToast } from "@/components/ToastProvider";
import { usePosSale, useReturnSale } from "@/hooks/usePos";
import { taka } from "@/lib/pos-cart";
import { refundEstimate } from "@/lib/pos-return";

/**
 * Return some items of a sale (or all of them). Each line gets a − qty +
 * picker up to what is still not returned; the refund is that share of what
 * the customer actually paid (discounts and VAT included).
 */
export function ReturnItemsDialog({
  id,
  onClose,
  onDone,
}: {
  id: number;
  onClose: () => void;
  onDone?: () => void;
}) {
  const toast = useToast();
  const { data: s } = usePosSale(id);
  const ret = useReturnSale();
  const [qty, setQty] = useState<Record<number, number>>({});
  const [reason, setReason] = useState("");

  const lines = (s?.items ?? []).map((i) => ({
    ...i,
    left: i.quantity - (i.restockedQuantity ?? 0),
    pick: qty[i.id] ?? 0,
  }));
  const picked = lines.filter((l) => l.pick > 0);
  const refund = s
    ? refundEstimate(
        s,
        picked.map((l) => ({ unitPrice: l.unitPrice, qty: l.pick })),
        lines.every((l) => l.pick === l.left),
      )
    : 0;
  const set = (itemId: number, n: number) =>
    setQty((q) => ({ ...q, [itemId]: n }));

  const submit = () =>
    ret.mutate(
      {
        id,
        reason: reason.trim() || undefined,
        items: picked.map((l) => ({ itemId: l.id, qty: l.pick })),
      },
      {
        onSuccess: () => {
          toast.push(`Returned — ${taka(refund)} refunded`, "success");
          onDone?.();
          onClose();
        },
        onError: (e) => toast.push(e.message),
      },
    );

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Return items"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
            <Icon name="undo" size={22} />
          </span>
          <div>
            <h2 className="text-lg font-bold">
              Return items{s ? ` · ${s.orderNumber}` : ""}
            </h2>
            <p className="text-sm text-gray-600">
              Pick how many of each item come back. Stock goes back to{" "}
              {s?.store?.name ?? "the store"}.
            </p>
          </div>
        </div>
        {!s ? (
          <div className="py-8 text-center text-gray-500">Loading…</div>
        ) : (
          <>
            <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
              {lines.map((l) => (
                <div key={l.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">
                      {l.productNameSnapshot}
                      {l.variantLabel && (
                        <span className="font-normal text-gray-500">
                          {" "}
                          · {l.variantLabel}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {l.quantity} × {taka(Number(l.unitPrice))}
                      {l.quantity - l.left > 0 && (
                        <span className="ml-1 font-bold text-red-600">
                          · {l.quantity - l.left} returned
                        </span>
                      )}
                    </div>
                  </div>
                  {l.left === 0 ? (
                    <span className="text-xs font-bold text-gray-400">
                      All returned
                    </span>
                  ) : (
                    <div className="flex items-center overflow-hidden rounded-lg border border-gray-200">
                      <button
                        className="grid h-9 w-9 place-items-center hover:bg-gray-50 disabled:opacity-30"
                        disabled={l.pick <= 0}
                        onClick={() => set(l.id, l.pick - 1)}
                        aria-label={`One less ${l.productNameSnapshot}`}
                      >
                        <Icon name="remove" size={18} />
                      </button>
                      <span className="w-12 text-center text-sm font-bold">
                        {l.pick}/{l.left}
                      </span>
                      <button
                        className="grid h-9 w-9 place-items-center text-[#1d7a46] hover:bg-emerald-50 disabled:opacity-30"
                        disabled={l.pick >= l.left}
                        onClick={() => set(l.id, l.pick + 1)}
                        aria-label={`One more ${l.productNameSnapshot}`}
                      >
                        <Icon name="add" size={18} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              className="mt-2 text-sm font-semibold text-[#1d7a46] hover:underline"
              onClick={() =>
                setQty(Object.fromEntries(lines.map((l) => [l.id, l.left])))
              }
            >
              Select everything left
            </button>
            <input
              className="mt-3 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#1d7a46]"
              placeholder="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="mt-4 flex items-center justify-between rounded-xl bg-red-50 px-4 py-3">
              <span className="text-sm font-semibold text-red-800">
                Refund to customer
              </span>
              <span className="text-xl font-extrabold text-red-700">
                {taka(refund)}
              </span>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="h-10 rounded-lg border border-gray-200 px-4 text-sm font-semibold"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="h-10 rounded-lg bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-40"
                disabled={!picked.length || ret.isPending}
                onClick={submit}
              >
                {ret.isPending
                  ? "Returning…"
                  : `Return ${picked.reduce((n, l) => n + l.pick, 0)} item${picked.reduce((n, l) => n + l.pick, 0) === 1 ? "" : "s"}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
