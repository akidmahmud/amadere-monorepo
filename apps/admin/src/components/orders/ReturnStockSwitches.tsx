"use client";

import { useSetReturnStock, type AdminOrder } from "@/hooks/useOrders";

/**
 * Returned order: one switch per line — are the returned units in the main
 * inventory? Off = they stay out (e.g. damaged spice). Can be flipped any time.
 */
export function ReturnStockSwitches({ order }: { order: AdminOrder }) {
  const set = useSetReturnStock(order.id);
  // Returns from before per-line counts existed put everything back.
  const counted = order.items.some(
    (i) => (i.restockedQuantity ?? 0) > 0 || (i.writtenOffQuantity ?? 0) > 0,
  );
  const lines = order.items
    .map((i) => {
      const onShelf = counted ? (i.restockedQuantity ?? 0) : i.quantity;
      const returned = counted ? onShelf + (i.writtenOffQuantity ?? 0) : i.quantity;
      return { id: i.id, name: i.name, onShelf, returned };
    })
    .filter((l) => l.returned > 0);
  if (!lines.length) return null;

  return (
    <div className="mt-3 rounded-md border border-border p-3">
      <p className="mb-2 text-xs font-bold text-text">Returned stock — add to main inventory?</p>
      <div className="flex flex-col gap-1.5">
        {lines.map((l) => {
          const on = l.onShelf === l.returned;
          return (
            <label key={l.id} className="flex cursor-pointer items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                role="switch"
                checked={on}
                disabled={set.isPending}
                onChange={() => set.mutate([{ itemId: l.id, restock: on ? 0 : l.returned }])}
                className="h-4 w-4 accent-emerald-700"
              />
              <span className="flex-1">
                {l.name} <span className="text-xs text-muted">× {l.returned}</span>
              </span>
              <span className={`text-xs font-semibold ${on ? "text-emerald-700" : "text-muted"}`}>
                {on ? "In main inventory" : l.onShelf > 0 ? `${l.onShelf} in inventory` : "Kept out"}
              </span>
            </label>
          );
        })}
      </div>
      {set.isError && (
        <p className="mt-2 text-xs font-semibold text-danger">{(set.error as Error).message}</p>
      )}
    </div>
  );
}
