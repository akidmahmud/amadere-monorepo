"use client";

import { Button } from "@amader/admin-ui";
import type { Attribute } from "@/hooks/useAttributes";
import type { CostPriceUnit, VariantInput } from "@/hooks/useProducts";
import { computeVariantCost } from "@/lib/variant-cost";
import { VariantRowForm } from "./VariantRowForm";

export interface NewVariantsBuilderProps {
  attributes: Attribute[];
  variants: VariantInput[];
  onChange: (variants: VariantInput[]) => void;
  /** Product-wide default cost price — undefined = no cost entered. Flat per-variant unless costPriceUnit is set. */
  costPerItem?: number;
  /** When set, costPerItem is a rate scaled by each variant's own weightOverride instead of a flat cost. */
  costPriceUnit?: CostPriceUnit | null;
}

function labelFor(attributes: Attribute[], attributeValueIds: number[]): string {
  return attributeValueIds
    .map((valueId) => {
      for (const attr of attributes) {
        const value = attr.values.find((v) => v.id === valueId);
        if (value) return value.translations[0]?.value;
      }
      return null;
    })
    .filter(Boolean)
    .join(" / ");
}

// Used on the New Product page — the product doesn't exist yet, so variants
// accumulate as plain local state and go out as one array in the create
// request (the one place the backend documents accepting a `variants[]`
// directly). Editing an existing product's variants uses
// ExistingVariantsManager instead, which calls the real add/remove
// endpoints immediately.
export function NewVariantsBuilder({ attributes, variants, onChange, costPerItem, costPriceUnit }: NewVariantsBuilderProps) {
  return (
    <div>
      <span className="mb-2.5 block text-xs font-bold text-emerald-950">Defined Variants ({variants.length})</span>
      {attributes.length === 0 && (
        <p className="mb-3 text-xs font-medium text-emerald-900/60">Select at least one attribute above to define variants.</p>
      )}
      <div className="mb-3 flex flex-col gap-2">
        {variants.map((v, i) => {
          const effectiveCost = computeVariantCost(costPerItem, costPriceUnit, v.weightOverride);
          const profit = effectiveCost !== undefined ? v.price - effectiveCost : null;
          const saleProfit = effectiveCost !== undefined && v.salePrice != null ? v.salePrice - effectiveCost : null;
          return (
            <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-emerald-800/15 bg-gradient-to-r from-emerald-50/40 via-white to-amber-50/20 p-3 shadow-xs">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-emerald-950">
                <span className="font-extrabold text-emerald-900">{labelFor(attributes, v.attributeValueIds)}</span>
                <span className="rounded-full bg-emerald-800/10 px-2.5 py-0.5 font-bold text-emerald-800">৳{v.price}</span>
                {v.salePrice != null && (
                  <span className="rounded-full bg-amber-400/20 px-2 py-0.5 font-bold text-amber-800 border border-amber-400/30">
                    sale ৳{v.salePrice}
                  </span>
                )}
                {v.weightOverride != null && <span className="text-emerald-900/70">{v.weightOverride}kg</span>}
                {v.isDefault && <span className="font-extrabold text-amber-600">(default)</span>}
                {profit !== null && (
                  <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${profit < 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-800 text-amber-300"}`}>
                    profit ৳{profit.toFixed(2)}
                  </span>
                )}
                {saleProfit !== null && (
                  <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${saleProfit < 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-800 text-amber-300"}`}>
                    sale profit ৳{saleProfit.toFixed(2)}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 transition-all hover:bg-rose-100"
                onClick={() => onChange(variants.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>
      {attributes.length > 0 && (
        <VariantRowForm
          attributes={attributes}
          submitLabel="Add variant"
          onSubmit={(v) => onChange([...variants, v])}
          costPerItem={costPerItem}
          costPriceUnit={costPriceUnit}
        />
      )}
    </div>
  );
}
