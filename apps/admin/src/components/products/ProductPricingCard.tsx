"use client";

import type { ProductFormState } from "./useProductFormState";

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-ink font-semibold outline-none focus:border-brand-500";
const readonlyClass = "h-10 rounded-sm border border-border bg-surface-2 px-3 text-sm text-muted outline-none";

export function ProductPricingCard({ form }: { form: ProductFormState }) {
  const price = Number(form.price) || 0;
  const cost = Number(form.costPerItem) || 0;
  const hasCost = form.costPerItem.trim() !== "";
  const profit = price - cost;
  const margin = price > 0 ? (profit / price) * 100 : 0;

  return (
    <div className="rounded-card border border-border bg-surface p-[18px]">
      <h3 className="mb-3.5 text-[0.9rem] font-extrabold text-text">Pricing</h3>

      {form.hasVariants ? (
        <p className="mb-3.5 text-sm text-muted">
          This product has variants — price, sale price, and profit are set per-variant in the Variants tab. Cost
          price below is the product-wide default, used when a variant doesn&apos;t set its own.
        </p>
      ) : (
        <div className="mb-3.5 grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-text">
              Regular Price (৳)<span className="ml-0.5 text-danger">*</span>
            </span>
            <input type="number" required value={form.price} onChange={(e) => form.setPrice(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-text">Sale Price (৳)</span>
            <input type="number" value={form.salePrice} onChange={(e) => form.setSalePrice(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-text">Cost Price (৳)</span>
            <input type="number" value={form.costPerItem} onChange={(e) => form.setCostPerItem(e.target.value)} className={inputClass} />
          </label>
        </div>
      )}

      {form.hasVariants && (
        <label className="mb-3.5 flex flex-col gap-1.5 max-w-[calc((100%-1.5rem)/3)]">
          <span className="text-xs font-bold text-text">Default Cost Price (৳)</span>
          <input type="number" value={form.costPerItem} onChange={(e) => form.setCostPerItem(e.target.value)} className={inputClass} />
        </label>
      )}

      {!form.hasVariants && (
        <div className="mb-3.5 grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-text">Sale starts (optional)</span>
            <input type="date" value={form.saleStartsAt} onChange={(e) => form.setSaleStartsAt(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-text">Sale ends (optional)</span>
            <input type="date" value={form.saleEndsAt} onChange={(e) => form.setSaleEndsAt(e.target.value)} className={inputClass} />
          </label>
        </div>
      )}

      {!form.hasVariants && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-muted">Profit</span>
              <input readOnly value={hasCost ? `৳ ${profit.toFixed(2)}` : "—"} className={readonlyClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-muted">Margin</span>
              <input readOnly value={hasCost && price > 0 ? `${margin.toFixed(2)}%` : "—"} className={readonlyClass} />
            </label>
          </div>

          {hasCost && price > 0 && (
            <div
              className="mt-3.5 flex items-center gap-1.5 rounded-sm px-3 py-2.5 text-[0.73rem] font-bold"
              style={{
                background: profit >= 0 ? "#e6f8ef" : "#feeaec",
                color: profit >= 0 ? "#16a06d" : "#e8465e",
                border: `1px solid ${profit >= 0 ? "#c8eeda" : "#f6c8ce"}`,
              }}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {profit >= 0
                ? `You will earn ৳${profit.toFixed(2)} profit on each sale`
                : `This is a loss of ৳${Math.abs(profit).toFixed(2)} per sale at the current cost`}
            </div>
          )}
        </>
      )}
    </div>
  );
}
