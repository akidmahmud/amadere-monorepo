"use client";

import { useState } from "react";
import { Modal } from "@amader/admin-ui";
import { useOrder, useUpdateOrderStatus } from "@/hooks/useOrders";
import { returnLinesError, shelfWriteOffError } from "@/lib/return-lines";

type Status = "RETURNED" | "PARTIALLY_RETURNED";

/**
 * Marking an order Returned / Partially Returned. A delivered order asks,
 * per item, how many go back to stock and how many are damaged and written
 * off (spices can't be resold). An undelivered one: a switch per item for
 * whether it goes back into the main inventory.
 */
export function ReturnLinesDialog({
  orderId,
  status,
  onClose,
}: {
  orderId: number;
  status: Status;
  onClose: () => void;
}) {
  const { data: order, isLoading } = useOrder(orderId);
  const update = useUpdateOrderStatus(orderId);
  const [counts, setCounts] = useState<
    Record<number, { restock: string; writeOff: string }>
  >({});
  // Undelivered parcel coming back: which lines go into the main inventory.
  const [toStock, setToStock] = useState<Record<number, boolean>>({});

  const delivered = !!order?.completedAt;
  // Returned earlier and not completed again: the goods are already back on
  // the shelf, so only damage is entered (it comes off the shelf).
  const onShelfMode = delivered && !!order?.stockBackOnShelf;
  const counted = (order?.items ?? []).some(
    (i) => (i.restockedQuantity ?? 0) > 0 || (i.writtenOffQuantity ?? 0) > 0,
  );
  const lines = (order?.items ?? []).map((i) => {
    const c = counts[i.id];
    // A full return after a partial one starts from what was recorded then
    // (already written off stays written off; the rest comes back).
    const prevOff = i.writtenOffQuantity ?? 0;
    const restock =
      c?.restock ??
      (status === "RETURNED" ? String(i.quantity - prevOff) : "0");
    const writeOff =
      c?.writeOff ??
      (status === "RETURNED" || onShelfMode ? String(prevOff) : "0");
    return {
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      restockRaw: restock,
      writeOffRaw: writeOff,
      restock: Number(restock) || 0,
      writeOff: Number(writeOff) || 0,
      // Shelf mode: what is back on the shelf now (orders returned before
      // counts existed put everything back).
      prevOff: counted ? prevOff : 0,
      onShelf: counted ? (i.restockedQuantity ?? 0) : i.quantity,
    };
  });
  const error = !delivered
    ? null
    : onShelfMode
      ? shelfWriteOffError(lines)
      : returnLinesError(lines, status);
  const set = (id: number, field: "restock" | "writeOff", v: string) => {
    const cur = lines.find((l) => l.id === id)!;
    setCounts((c) => ({
      ...c,
      [id]: {
        restock: field === "restock" ? v : cur.restockRaw,
        writeOff: field === "writeOff" ? v : cur.writeOffRaw,
      },
    }));
  };
  const save = () =>
    update.mutate(
      {
        status,
        returnLines: delivered
          ? lines.map((l) => ({
              itemId: l.id,
              restock: onShelfMode ? 0 : l.restock,
              writeOff: l.writeOff,
            }))
          : lines.map((l) => ({
              itemId: l.id,
              restock: toStock[l.id] ? l.quantity : 0,
              writeOff: toStock[l.id] ? 0 : l.quantity,
            })),
      },
      { onSuccess: onClose },
    );

  return (
    <Modal
      open
      onClose={onClose}
      title={
        status === "RETURNED"
          ? "Mark as Returned"
          : "Mark as Partially Returned"
      }
    >
      <div className="flex flex-col gap-4">
        {isLoading || !order ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : !delivered ? (
          <>
            <p className="text-sm text-muted">
              Switch on the items to <b>add back to the main inventory</b>.
              Items left off stay out (e.g. damaged).
            </p>
            <div className="flex flex-col divide-y divide-border rounded-md border border-border">
              {lines.map((l) => (
                <label
                  key={l.id}
                  className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    role="switch"
                    checked={!!toStock[l.id]}
                    onChange={(e) =>
                      setToStock((t) => ({ ...t, [l.id]: e.target.checked }))
                    }
                    className="h-4 w-4 accent-emerald-700"
                  />
                  <span className="flex-1">
                    {l.name}{" "}
                    <span className="text-xs text-muted">× {l.quantity}</span>
                  </span>
                  <span className="text-xs text-muted">
                    {toStock[l.id] ? "Main inventory" : "Kept out"}
                  </span>
                </label>
              ))}
            </div>
          </>
        ) : onShelfMode ? (
          <>
            <p className="text-sm text-muted">
              These items are <b>already back in stock</b> from an earlier
              return. Enter only how many are <b>damaged</b>: they come off the
              stock as a write-off.
            </p>
            <div className="flex flex-col divide-y divide-border rounded-md border border-border">
              {lines.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center gap-3 px-3 py-2 text-sm"
                >
                  <span className="flex-1">
                    {l.name}{" "}
                    <span className="text-xs text-muted">
                      {l.onShelf} back in stock
                      {l.prevOff > 0 && `, ${l.prevOff} already written off`}
                    </span>
                  </span>
                  <label className="flex items-center gap-1 text-xs">
                    Damaged, write off (total)
                    <input
                      type="number"
                      min={l.prevOff}
                      max={l.prevOff + l.onShelf}
                      value={l.writeOffRaw}
                      onChange={(e) => set(l.id, "writeOff", e.target.value)}
                      className="h-8 w-16 rounded-sm border border-border px-2 text-right"
                    />
                  </label>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">
              For each item: how many go <b>back to stock</b>, and how many are{" "}
              <b>damaged and written off</b> (not added back).
              {status === "PARTIALLY_RETURNED" &&
                " Anything not entered stays with the customer."}
            </p>
            <div className="flex flex-col divide-y divide-border rounded-md border border-border">
              {lines.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center gap-3 px-3 py-2 text-sm"
                >
                  <span className="flex-1">
                    {l.name}{" "}
                    <span className="text-xs text-muted">× {l.quantity}</span>
                  </span>
                  <label className="flex items-center gap-1 text-xs">
                    Back to stock
                    <input
                      type="number"
                      min={0}
                      max={l.quantity}
                      value={l.restockRaw}
                      onChange={(e) => set(l.id, "restock", e.target.value)}
                      className="h-8 w-16 rounded-sm border border-border px-2 text-right"
                    />
                  </label>
                  <label className="flex items-center gap-1 text-xs">
                    Damaged, write off
                    <input
                      type="number"
                      min={0}
                      max={l.quantity}
                      value={l.writeOffRaw}
                      onChange={(e) => set(l.id, "writeOff", e.target.value)}
                      className="h-8 w-16 rounded-sm border border-border px-2 text-right"
                    />
                  </label>
                </div>
              ))}
            </div>
          </>
        )}
        {(error || update.isError) && (
          <p className="text-sm font-semibold text-danger">
            {error ?? (update.error as Error).message}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-md border border-border px-4 text-sm font-bold"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!order || !!error || update.isPending}
            onClick={save}
            className="h-10 rounded-md bg-[#2e7d43] px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {update.isPending ? "Saving…" : "Confirm"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
