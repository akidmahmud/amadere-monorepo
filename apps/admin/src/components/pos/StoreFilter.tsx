"use client";

import { usePosContext } from "./PosContext";

/**
 * Store filter for the manager pages: "All stores" + each store for
 * all-stores staff; a store-bound user just sees their store's name.
 * value null = all stores.
 */
export function StoreFilter({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const { allStores, stores, store } = usePosContext();
  if (!allStores)
    return (
      <span className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold">
        {store?.name}
      </span>
    );
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold"
      aria-label="Store"
    >
      <option value="">All stores</option>
      {stores.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
