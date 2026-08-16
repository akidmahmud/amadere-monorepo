"use client";

import { useState } from "react";
import { Button } from "@amader/admin-ui";
import type { Attribute } from "@/hooks/useAttributes";
import type { CostPriceUnit, VariantInput } from "@/hooks/useProducts";
import { computeVariantCost } from "@/lib/variant-cost";

export interface VariantRowFormProps {
  attributes: Attribute[];
  onSubmit: (variant: VariantInput) => void;
  submitLabel: string;
  pending?: boolean;
  /** Product-wide default cost price — undefined = no cost entered. Flat per-variant unless costPriceUnit is set. */
  costPerItem?: number;
  /** When set, costPerItem is a rate scaled by this row's own Weight (kg) field instead of a flat cost. */
  costPriceUnit?: CostPriceUnit | null;
}

// One attribute-value picker per selected axis (e.g. Size, Color) plus the
// variant's own sku/price/stock — shared between the "build variants before
// the product exists yet" flow (new product) and the "add one more variant"
// flow (existing product), since the row shape is identical either way.
export function VariantRowForm({ attributes, onSubmit, submitLabel, pending, costPerItem, costPriceUnit }: VariantRowFormProps) {
  const [valueByAttribute, setValueByAttribute] = useState<Record<number, number>>({});
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [weight, setWeight] = useState("");
  const [stock, setStock] = useState("0");
  const [isDefault, setIsDefault] = useState(false);

  const effectiveCost = computeVariantCost(costPerItem, costPriceUnit, weight ? Number(weight) : undefined);
  const profit = effectiveCost !== undefined && price ? Number(price) - effectiveCost : null;
  const saleProfit = effectiveCost !== undefined && salePrice ? Number(salePrice) - effectiveCost : null;

  const canSubmit = attributes.length > 0 && attributes.every((a) => valueByAttribute[a.id]) && price;

  function submit() {
    if (!canSubmit) return;
    onSubmit({
      sku: sku || undefined,
      price: Number(price),
      salePrice: salePrice ? Number(salePrice) : undefined,
      weightOverride: weight ? Number(weight) : undefined,
      stock: Number(stock),
      isDefault,
      attributeValueIds: Object.values(valueByAttribute),
    });
    setValueByAttribute({});
    setSku("");
    setPrice("");
    setSalePrice("");
    setWeight("");
    setStock("0");
    setIsDefault(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    submit();
  }

  // A plain <div>, not a <form> — this row is embedded inside the product
  // edit page's own <form> (ExistingVariantsManager), and nested <form>
  // elements are invalid HTML / trigger a hydration mismatch. Enter-to-submit
  // is preserved via onKeyDown instead of native form submission.
  return (
    <div onKeyDown={handleKeyDown} className="flex flex-wrap items-end gap-2.5 rounded-xl border border-emerald-800/20 bg-gradient-to-r from-emerald-50 via-white to-amber-50/30 p-3.5 shadow-sm">
      {attributes.map((attr) => (
        <label key={attr.id} className="flex flex-col gap-1">
          <span className="text-[11px] font-bold text-emerald-950">{attr.translations[0]?.name}</span>
          <select
            value={valueByAttribute[attr.id] ?? ""}
            onChange={(e) => setValueByAttribute((prev) => ({ ...prev, [attr.id]: Number(e.target.value) }))}
            className="h-9 rounded-lg border border-emerald-800/20 bg-white px-2.5 text-xs font-semibold text-emerald-950 outline-none transition-all focus:border-emerald-600 focus:ring-2 focus:ring-amber-400/30"
          >
            <option value="">Select</option>
            {attr.values.map((v) => (
              <option key={v.id} value={v.id}>
                {v.translations[0]?.value}
              </option>
            ))}
          </select>
        </label>
      ))}
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-bold text-emerald-950">SKU</span>
        <input
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          className="h-9 w-24 rounded-lg border border-emerald-800/20 bg-white px-2.5 text-xs font-semibold text-emerald-950 outline-none transition-all focus:border-emerald-600 focus:ring-2 focus:ring-amber-400/30"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-bold text-emerald-950">Price</span>
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="num h-9 w-20 rounded-lg border border-emerald-800/20 bg-white px-2.5 text-xs font-semibold text-emerald-950 outline-none transition-all focus:border-emerald-600 focus:ring-2 focus:ring-amber-400/30"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-bold text-emerald-950">Sale price</span>
        <input
          type="number"
          value={salePrice}
          onChange={(e) => setSalePrice(e.target.value)}
          className="num h-9 w-20 rounded-lg border border-emerald-800/20 bg-white px-2.5 text-xs font-semibold text-emerald-950 outline-none transition-all focus:border-emerald-600 focus:ring-2 focus:ring-amber-400/30"
        />
      </label>
      {costPriceUnit && (
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold text-emerald-950">Weight (kg)</span>
          <input
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="num h-9 w-20 rounded-lg border border-emerald-800/20 bg-white px-2.5 text-xs font-semibold text-emerald-950 outline-none transition-all focus:border-emerald-600 focus:ring-2 focus:ring-amber-400/30"
          />
        </label>
      )}
      {costPerItem !== undefined && (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-emerald-950">Profit</span>
            <span
              className={`flex h-9 w-20 items-center rounded-lg border px-2.5 text-xs font-extrabold shadow-xs ${
                profit !== null && profit < 0
                  ? "border-rose-300 bg-rose-50 text-rose-700"
                  : "border-amber-400/40 bg-gradient-to-r from-emerald-800 to-emerald-900 text-amber-300 ring-1 ring-amber-400/30"
              }`}
            >
              {profit !== null ? `৳${profit.toFixed(2)}` : "—"}
            </span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-emerald-950">Sale profit</span>
            <span
              className={`flex h-9 w-20 items-center rounded-lg border px-2.5 text-xs font-extrabold shadow-xs ${
                saleProfit !== null && saleProfit < 0
                  ? "border-rose-300 bg-rose-50 text-rose-700"
                  : "border-amber-400/40 bg-gradient-to-r from-emerald-800 to-emerald-900 text-amber-300 ring-1 ring-amber-400/30"
              }`}
            >
              {saleProfit !== null ? `৳${saleProfit.toFixed(2)}` : "—"}
            </span>
          </label>
        </>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-bold text-emerald-950">Stock</span>
        <input
          type="number"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          className="num h-9 w-16 rounded-lg border border-emerald-800/20 bg-white px-2.5 text-xs font-semibold text-emerald-950 outline-none transition-all focus:border-emerald-600 focus:ring-2 focus:ring-amber-400/30"
        />
      </label>
      <label className="flex items-center gap-1.5 pb-2 text-xs font-bold text-emerald-950 cursor-pointer select-none">
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="h-3.5 w-3.5 accent-emerald-700" />
        Default
      </label>
      <button
        type="button"
        disabled={!canSubmit || pending}
        onClick={submit}
        className="h-9 shrink-0 rounded-lg bg-gradient-to-r from-emerald-800 via-emerald-700 to-emerald-900 px-4 text-xs font-extrabold text-amber-300 shadow-md shadow-emerald-900/15 ring-1 ring-amber-400/40 transition-all hover:from-emerald-700 hover:to-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitLabel}
      </button>
    </div>
  );
}
