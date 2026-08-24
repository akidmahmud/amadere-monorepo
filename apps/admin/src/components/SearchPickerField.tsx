"use client";

import { useState } from "react";
import { PickerPrice } from "@/components/PickerPrice";

export interface SearchPickerOption {
  id: number;
  label: string;
  /** Optional — product pickers pass these so the list can show a price
   *  beside each name. Non-product pickers (categories) simply omit them. */
  price?: string | null;
  salePrice?: string | null;
}

// Same search-then-checkbox-list pattern as CrossSellFields.tsx (selected
// items as removable chips, a search box, a scrollable filtered list below)
// — extracted here since the discount form needs it twice (products,
// categories) across two pages (create/edit), where a plain "every option
// as a checkbox" list becomes unusable once the catalog has more than a
// couple dozen items.
export function SearchPickerField({
  label,
  options,
  selected,
  onChange,
  placeholder = "Search...",
  emptyHint = "No matches.",
}: {
  label: string;
  options: SearchPickerOption[];
  selected: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
  emptyHint?: string;
}) {
  const [search, setSearch] = useState("");
  const selectedOptions = options.filter((o) => selected.includes(o.id));
  const filtered = options.filter((o) => o.label.toLowerCase().includes(search.trim().toLowerCase()));

  function toggle(id: number) {
    onChange(selected.includes(id) ? selected.filter((i) => i !== id) : [...selected, id]);
  }

  return (
    <div>
      <span className="mb-2 block text-xs font-semibold text-secondary">{label}</span>
      {selectedOptions.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedOptions.map((o) => (
            <span
              key={o.id}
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-brand-50 px-2.5 py-1 text-[0.68rem] font-bold text-brand-500"
            >
              {o.label}
              <button
                type="button"
                onClick={() => toggle(o.id)}
                className="font-extrabold opacity-80 hover:opacity-100"
                aria-label={`Remove ${o.label}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-inner border border-border bg-surface px-2.5 text-[0.74rem] text-text outline-none focus:border-brand-500"
      />
      <div className="mt-1.5 flex max-h-[210px] flex-col gap-0.5 overflow-y-auto rounded-inner border border-border p-1.5">
        {filtered.map((o) => (
          <label
            key={o.id}
            className="flex cursor-pointer items-center gap-2 rounded-[7px] px-1.5 py-1.5 text-[0.74rem] font-semibold text-text hover:bg-surface-2"
          >
            <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggle(o.id)} className="h-3.5 w-3.5 shrink-0 accent-brand-500" />
            <span className="min-w-0 flex-1 truncate">{o.label}</span>
            <PickerPrice price={o.price} salePrice={o.salePrice} />
          </label>
        ))}
        {filtered.length === 0 && <p className="px-1.5 py-2 text-[0.72rem] text-muted">{emptyHint}</p>}
      </div>
    </div>
  );
}
