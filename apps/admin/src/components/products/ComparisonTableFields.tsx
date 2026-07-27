"use client";

import { Button } from "@amader/admin-ui";
import type { ComparisonRowState } from "./useProductFormState";
import type { ProductFormState } from "./useProductFormState";

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

// PDP "Why Choose Us" comparison table — a row per feature, checkmark under
// the own-product column and/or the competitor column. Hidden entirely on
// the storefront when no rows have a feature filled in, so this whole
// section is optional per product.
export function ComparisonTableFields({ form }: { form: ProductFormState }) {
  function updateRow(i: number, patch: Partial<ComparisonRowState>) {
    form.setComparisonRows(form.comparisonRows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  return (
    <div className="rounded-card border border-border bg-surface p-[18px]">
      <h3 className="mb-1 text-[0.9rem] font-extrabold text-text">Comparison Table</h3>
      <p className="mb-3.5 text-xs text-muted">
        Optional "Why Choose Us" table — leave every row empty to hide this section on the product page.
      </p>
      <div className="mb-3.5 grid grid-cols-3 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-text">Title (optional)</span>
          <input
            value={form.comparisonTitle}
            onChange={(e) => form.setComparisonTitle(e.target.value)}
            placeholder={`Why Choose ${form.name || "This Product"}?`}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-text">Own column label</span>
          <input
            value={form.comparisonOwnLabel}
            onChange={(e) => form.setComparisonOwnLabel(e.target.value)}
            placeholder={form.name || "This product"}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-text">Competitor column label</span>
          <input
            value={form.comparisonCompetitorLabel}
            onChange={(e) => form.setComparisonCompetitorLabel(e.target.value)}
            placeholder="Regular alternative"
            className={inputClass}
          />
        </label>
      </div>

      <div className="flex flex-col gap-2.5">
        {form.comparisonRows.map((row, i) => (
          <div key={i} className="flex items-end gap-3 rounded-inner bg-surface-2 p-3">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Feature</span>
              <input value={row.feature} onChange={(e) => updateRow(i, { feature: e.target.value })} className={inputClass} />
            </label>
            <label className="flex items-center gap-1.5 pb-2.5 text-xs font-semibold text-secondary">
              <input type="checkbox" checked={row.own} onChange={(e) => updateRow(i, { own: e.target.checked })} />
              Own
            </label>
            <label className="flex items-center gap-1.5 pb-2.5 text-xs font-semibold text-secondary">
              <input type="checkbox" checked={row.competitor} onChange={(e) => updateRow(i, { competitor: e.target.checked })} />
              Competitor
            </label>
            <Button
              type="button"
              variant="link"
              className="pb-2.5 text-danger"
              onClick={() => form.setComparisonRows(form.comparisonRows.filter((_, j) => j !== i))}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        className="mt-2.5"
        onClick={() => form.setComparisonRows([...form.comparisonRows, { feature: "", own: true, competitor: false }])}
      >
        Add row
      </Button>
    </div>
  );
}
