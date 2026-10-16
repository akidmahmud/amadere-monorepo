"use client";

import { useState } from "react";
import { taka, weighedPrice } from "@/lib/pos-cart";

const MAX_KG = 50;

/** Ask for an item's weight (kg); shows the price as you type. */
export function WeightDialog({
  name,
  perKg,
  initialKg,
  onDone,
  onClose,
}: {
  name: string;
  perKg: number;
  initialKg?: number;
  onDone: (kg: number) => void;
  onClose: () => void;
}) {
  const [raw, setRaw] = useState(initialKg ? String(initialKg) : "");
  // "1,25" from a Bangla/European keypad means 1.25.
  const kg = Number(raw.replace(",", "."));
  const ok = raw.trim() !== "" && Number.isFinite(kg) && kg > 0 && kg <= MAX_KG;
  const done = () => {
    if (ok) onDone(Math.round(kg * 1000) / 1000);
  };
  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={`Weight of ${name}`}
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-lg font-bold">{name}</div>
        <div className="text-sm text-gray-500">{taka(perKg)}/kg</div>
        <label className="mt-4 block text-xs font-bold" htmlFor="pos-weight-kg">
          Weight (kg)
        </label>
        <input
          id="pos-weight-kg"
          autoFocus
          inputMode="decimal"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") done();
            if (e.key === "Escape") onClose();
          }}
          placeholder="e.g. 1.250"
          className="mt-1 h-12 w-full rounded-xl border border-gray-200 px-3 text-xl font-bold outline-none focus:border-[#1d7a46]"
        />
        <div className="mt-3 flex items-baseline justify-between">
          <span className="text-sm text-gray-600">Price</span>
          <span className="text-2xl font-extrabold">
            {ok ? taka(weighedPrice(perKg, kg)) : "—"}
          </span>
        </div>
        {raw.trim() !== "" && !ok && (
          <div className="mt-1 text-sm text-red-600">
            Enter a weight between 0 and {MAX_KG} kg
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="h-11 rounded-xl border border-gray-200 px-4 font-bold"
          >
            Cancel
          </button>
          <button
            onClick={done}
            disabled={!ok}
            className="h-11 rounded-xl bg-[#1d7a46] px-5 font-bold text-white disabled:opacity-40"
          >
            {initialKg ? "Update" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
