"use client";

import { WEIGHT_UNITS, type WeightUnit } from "@/lib/pos-weight";

/** Number + unit picker (g / kg / ml / L) for a product's weight or volume. */
export function WeightField({
  value,
  unit,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  unit: WeightUnit;
  onChange: (value: string, unit: WeightUnit) => void;
  placeholder?: string;
  label: string;
}) {
  const bad = value.trim() !== "" && !(Number(value) > 0);
  return (
    <div
      className={`flex h-10 overflow-hidden rounded-lg border bg-white focus-within:border-[#1d7a46] ${bad ? "border-red-400" : "border-gray-200"}`}
    >
      <input
        className="min-w-0 flex-1 px-3 text-sm outline-none"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value, unit)}
        aria-label={label}
      />
      <select
        value={unit}
        onChange={(e) => onChange(value, e.target.value as WeightUnit)}
        className="border-l border-gray-200 bg-gray-50 px-2 text-sm font-semibold outline-none"
        aria-label={`${label} unit`}
      >
        {WEIGHT_UNITS.map((u) => (
          <option key={u.unit} value={u.unit}>
            {u.label}
          </option>
        ))}
      </select>
    </div>
  );
}
