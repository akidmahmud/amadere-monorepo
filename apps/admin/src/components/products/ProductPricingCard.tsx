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

  const salePrice = Number(form.salePrice) || 0;
  const hasSalePrice = form.salePrice.trim() !== "";
  const saleProfit = salePrice - cost;
  const saleMargin = salePrice > 0 ? (saleProfit / salePrice) * 100 : 0;

  return (
    <div className="rounded-card border border-border bg-surface p-[18px]">
      <h3 className="mb-3.5 text-[0.9rem] font-extrabold text-text">Pricing</h3>

      {form.hasVariants ? (
        <p className="mb-3.5 text-sm text-muted">
          This product has variants — price, sale price, and profit are set per-variant in the Variants tab. Cost
          price below is the product-wide default, used when a variant doesn&apos;t set its own.
        </p>
      ) : (
        <div className="mb-3.5 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-text">
              Regular Price (৳)<span className="ml-0.5 text-danger">*</span>
            </span>
            <input type="number" value={form.price} onChange={(e) => form.setPrice(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-text">Sale Price (৳)</span>
            <input type="number" value={form.salePrice} onChange={(e) => form.setSalePrice(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-text">Cost Price (৳)</span>
            <input type="number" value={form.costPerItem} onChange={(e) => form.setCostPerItem(e.target.value)} className={inputClass} />
          </label>
          {/* Same field as "Shippable weight, kg" on the Shipping tab (one
              piece of state, edit either and both stay in sync) — surfaced
              here too since it's easy to miss on its own tab, and it's
              required to save. Also what the storefront card shows in its
              pack/weight slot for a simple product with no variants to pick
              from — see toProductCardData's formatShippableWeight. */}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-text">
              Weight (kg)<span className="ml-0.5 text-danger">*</span>
            </span>
            <input type="number" value={form.shippableWeight} onChange={(e) => form.setShippableWeight(e.target.value)} className={inputClass} />
            <span className="text-xs text-muted">Used for courier charging and shown on the product card.</span>
          </label>
        </div>
      )}

      {form.hasVariants && (
        <label className="mb-3.5 flex flex-col gap-1.5">
          <span className="text-xs font-bold text-text">Default Cost Price (৳)</span>
          <input type="number" value={form.costPerItem} onChange={(e) => form.setCostPerItem(e.target.value)} className={inputClass} />
        </label>
      )}

      {!form.hasVariants && (
        <div className="mb-3.5 flex flex-col gap-3">
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

          {hasSalePrice && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-muted">Sale Profit</span>
                <input readOnly value={hasCost ? `৳ ${saleProfit.toFixed(2)}` : "—"} className={readonlyClass} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-muted">Sale Margin</span>
                <input readOnly value={hasCost && salePrice > 0 ? `${saleMargin.toFixed(2)}%` : "—"} className={readonlyClass} />
              </label>
            </div>
          )}

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
                ? `You will earn ৳${profit.toFixed(2)} profit on each sale at regular price`
                : `This is a loss of ৳${Math.abs(profit).toFixed(2)} per sale at the current cost`}
            </div>
          )}

          {hasCost && hasSalePrice && salePrice > 0 && (
            <div
              className="mt-2 flex items-center gap-1.5 rounded-sm px-3 py-2.5 text-[0.73rem] font-bold"
              style={{
                background: saleProfit >= 0 ? "#e6f8ef" : "#feeaec",
                color: saleProfit >= 0 ? "#16a06d" : "#e8465e",
                border: `1px solid ${saleProfit >= 0 ? "#c8eeda" : "#f6c8ce"}`,
              }}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {saleProfit >= 0
                ? `You will earn ৳${saleProfit.toFixed(2)} profit on each sale at the sale price`
                : `This is a loss of ৳${Math.abs(saleProfit).toFixed(2)} per sale at the sale price`}
            </div>
          )}
        </>
      )}
    </div>
  );
}
