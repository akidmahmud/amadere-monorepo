"use client";

import { useState } from "react";
import { Button, Modal } from "@amader/admin-ui";
import {
  likelyPaymentAccount,
  useReturnWholesaleOrder,
  useWholesalePaymentAccounts,
  type WholesaleOrder,
} from "@/hooks/useWholesale";

const inputClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

const money = (v: number | string) =>
  `৳${Number(v).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Take back some or all of an order. Pick how many of each line came back;
 * the window shows the credit and any refund before anything is saved. The
 * server does the real sums (same formula): each unit is valued at its line
 * price less its share of the order discount; delivery is never returned.
 */
export function ReturnModal({
  order,
  onClose,
  onDone,
}: {
  order: WholesaleOrder;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const doReturn = useReturnWholesaleOrder();
  const accounts = useWholesalePaymentAccounts();
  const [qty, setQty] = useState<Record<number, number>>({});
  const [accountId, setAccountId] = useState<number | undefined>();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Order-level discount spread over the lines (as the server does it).
  const subtotal = Number(order.subtotal);
  const keep = subtotal > 0 ? (subtotal - Number(order.discount)) / subtotal : 1;
  const unitValue = (i: WholesaleOrder["items"][number]) =>
    (Number(i.lineTotal) / i.quantity) * keep;

  const picked = order.items.filter((i) => (qty[i.id] ?? 0) > 0);
  const credit = picked.reduce((s, i) => s + Math.round(unitValue(i) * qty[i.id] * 100) / 100, 0);
  const newTotal = Math.max(0, Number(order.total) - credit);
  const refund = Math.max(0, Number(order.paid) - newTotal);
  const chosenAccount = accountId ?? likelyPaymentAccount(accounts.data, "CASH");

  async function submit() {
    setError(null);
    try {
      await doReturn.mutateAsync({
        id: order.id,
        items: picked.map((i) => ({ itemId: i.id, quantity: qty[i.id] })),
        refundAccountId: refund > 0 ? chosenAccount : undefined,
        note: note.trim() || undefined,
      });
      onDone(
        refund > 0
          ? `Return saved — refund ${money(refund)} to the customer`
          : "Return saved",
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the return");
    }
  }

  return (
    <Modal open onClose={onClose} title={`Return items — ${order.orderNumber}`} className="max-w-2xl">
      <div className="flex flex-col gap-4">
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-surface-2 text-[10px] uppercase tracking-wide text-muted">
                <th className="px-3 py-2 text-left">Product</th>
                <th className="px-3 py-2 text-right">Sold</th>
                <th className="px-3 py-2 text-right">Returned</th>
                <th className="px-3 py-2 text-right">Return now</th>
                <th className="px-3 py-2 text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((i) => {
                const left = i.quantity - i.returnedQty;
                const n = qty[i.id] ?? 0;
                return (
                  <tr key={i.id} className="border-t border-border">
                    <td className="px-3 py-2 text-text">{i.name}</td>
                    <td className="px-3 py-2 text-right">{i.quantity}</td>
                    <td className="px-3 py-2 text-right text-muted">{i.returnedQty || "—"}</td>
                    <td className="px-3 py-2 text-right">
                      {left > 0 ? (
                        <input
                          type="number"
                          min={0}
                          max={left}
                          value={n}
                          onChange={(e) =>
                            setQty({
                              ...qty,
                              [i.id]: Math.min(left, Math.max(0, Math.floor(Number(e.target.value) || 0))),
                            })
                          }
                          aria-label={`Units of ${i.name} to return`}
                          className={`${inputClass} ml-auto w-20 text-right`}
                        />
                      ) : (
                        <span className="text-xs text-muted">All returned</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">{n ? money(unitValue(i) * n) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface-2 p-3 text-sm sm:grid-cols-4">
          <div>
            <span className="block text-[11px] text-secondary">Order total now</span>
            <b>{money(order.total)}</b>
          </div>
          <div>
            <span className="block text-[11px] text-secondary">Return credit</span>
            <b className="text-rose-600">− {money(credit)}</b>
          </div>
          <div>
            <span className="block text-[11px] text-secondary">New total</span>
            <b>{money(newTotal)}</b>
          </div>
          <div>
            <span className="block text-[11px] text-secondary">Refund to customer</span>
            <b className={refund > 0 ? "text-amber-600" : ""}>{money(refund)}</b>
          </div>
        </div>
        <p className="text-[11px] text-muted">
          Returned items go back into stock. The invoice drops by the credit; if more was
          collected than the new total, the difference is refunded and recorded in Accounts.
          Delivery charge is not returned.
        </p>

        {refund > 0 && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-secondary">Refund paid from</span>
            <select
              className={inputClass}
              value={chosenAccount ?? ""}
              onChange={(e) => setAccountId(Number(e.target.value))}
            >
              {accounts.data?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-secondary">Reason / note (optional)</span>
          <input
            className={inputClass}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. damaged packet"
          />
        </label>

        {error && <p className="text-sm font-semibold text-danger">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={picked.length === 0 || doReturn.isPending}
            onClick={submit}
          >
            {doReturn.isPending ? "Saving…" : "Save return"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
