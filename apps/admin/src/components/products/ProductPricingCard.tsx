"use client";

import type { ProductFormState } from "./useProductFormState";
import { COST_PRICE_UNIT_LABELS, computeVariantCost } from "@/lib/variant-cost";
import type { CostPriceUnit } from "@/hooks/useProducts";

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-ink font-semibold outline-none focus:border-brand-500";
const readonlyClass = "h-10 rounded-sm border border-border bg-surface-2 px-3 text-sm text-muted outline-none";

export function ProductPricingCard({ form }: { form: ProductFormState }) {
  const price = Number(form.price) || 0;
  const costPerItem = form.costPerItem.trim() !== "" ? Number(form.costPerItem) : undefined;
  // Simple products have exactly one weight field already (Weight (kg) /
  // shippableWeight below) — reused as the multiplier basis here instead of
  // a second, redundant weight input, unlike variants which each need their
  // own. undefined weight + costPriceUnit set = don't guess, same as variants.
  const shippableWeight = form.shippableWeight.trim() !== "" ? Number(form.shippableWeight) : undefined;
  const effectiveCost = computeVariantCost(costPerItem, form.costPriceUnit, shippableWeight);
  const hasCost = effectiveCost !== undefined;
  const cost = effectiveCost ?? 0;
  const profit = price - cost;
  const margin = price > 0 ? (profit / price) * 100 : 0;

  const salePrice = Number(form.salePrice) || 0;
  const hasSalePrice = form.salePrice.trim() !== "";
  const saleProfit = salePrice - cost;
  const saleMargin = salePrice > 0 ? (saleProfit / salePrice) * 100 : 0;

  return (
    <div className="rounded-card border border-border bg-surface p-[18px]">
      <h3 className="mb-3.5 text-[0.9rem] font-extrabold text-text">Pricing</h3>

      <details className="mb-3.5 rounded-sm border border-border bg-surface-2 p-3 text-xs">
        <summary className="cursor-pointer font-bold text-text">How Cost Price works / কস্ট প্রাইস কীভাবে কাজ করে</summary>
        <div className="mt-1.5 flex flex-col gap-1.5">
          <p className="leading-relaxed text-secondary">
            By default, Cost Price is a fixed amount used as-is for Profit/Margin. Turn on &quot;Calculate cost by
            weight&quot; to enter it as a rate instead (per kg / per 100g / per gram) — it&apos;s then multiplied by
            the product&apos;s Weight ({form.hasVariants ? "each variant's own Weight, set in the Variants tab" : "the Weight (kg) field below"})
            to get the real cost. Use the flat option when cost doesn&apos;t scale with size (boxes, bundles,
            fixed-price items); use per-weight when the same item is sold in different weight-based pack sizes.
          </p>
          <p lang="bn" className="leading-relaxed text-secondary">
            ডিফল্টভাবে, কস্ট প্রাইস একটি নির্দিষ্ট (ফিক্সড) মূল্য যা সরাসরি প্রফিট/মার্জিন হিসাব করতে ব্যবহৃত হয়।
            &quot;Calculate cost by weight&quot; চালু করলে এটিকে একটি রেট হিসেবে দিতে পারবেন (প্রতি কেজি / প্রতি ১০০
            গ্রাম / প্রতি গ্রাম) — তখন এটি পণ্যের ওজন (
            {form.hasVariants ? "প্রতিটি ভ্যারিয়েন্টের নিজস্ব ওজন, ভ্যারিয়েন্টস ট্যাবে সেট করা হয়" : "নিচের Weight (kg) ফিল্ড"}
            ) দিয়ে গুণ করে আসল খরচ বের করবে। যেসব পণ্যের খরচ সাইজ অনুযায়ী পরিবর্তিত হয় না (বক্স, বান্ডেল,
            ফিক্সড-প্রাইস আইটেম) সেগুলোর জন্য ফ্ল্যাট অপশন ব্যবহার করুন; একই পণ্য বিভিন্ন ওজনের প্যাকে বিক্রি হলে
            পার-ওয়েট অপশন ব্যবহার করুন।
          </p>
        </div>
      </details>

      {form.hasVariants ? (
        <p className="mb-3.5 text-sm text-muted">
          This product has variants — price and sale price are set per-variant in the Variants tab. Cost price below
          is either a flat cost applied to every variant, or (if you turn on per-weight calculation) a rate that
          gets multiplied by each variant&apos;s own weight — set per variant in the Variants tab.
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
            <span className="text-xs font-bold text-text">
              {form.costPriceUnit ? `Cost Price (৳ ${COST_PRICE_UNIT_LABELS[form.costPriceUnit]})` : "Cost Price (৳)"}
            </span>
            <input type="number" value={form.costPerItem} onChange={(e) => form.setCostPerItem(e.target.value)} className={inputClass} />
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-text">
            <input
              type="checkbox"
              checked={form.costPriceUnit !== null}
              onChange={(e) => form.setCostPriceUnit(e.target.checked ? "PER_KG" : null)}
            />
            Calculate cost by weight
          </label>
          {form.costPriceUnit && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-text">Rate is per</span>
              <select
                value={form.costPriceUnit}
                onChange={(e) => form.setCostPriceUnit(e.target.value as CostPriceUnit)}
                className={inputClass}
              >
                <option value="PER_KG">Kilogram</option>
                <option value="PER_100G">100 grams</option>
                <option value="PER_G">Gram</option>
              </select>
              <span className="text-xs text-muted">
                Cost = this rate × the product&apos;s Weight (kg) below. Leave unchecked for products where cost
                doesn&apos;t scale with weight (a fixed per-item cost).
              </span>
            </label>
          )}
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
        <div className="mb-3.5 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-text">
              {form.costPriceUnit ? `Cost Price (৳ ${COST_PRICE_UNIT_LABELS[form.costPriceUnit]})` : "Default Cost Price (৳)"}
            </span>
            <input type="number" value={form.costPerItem} onChange={(e) => form.setCostPerItem(e.target.value)} className={inputClass} />
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-text">
            <input
              type="checkbox"
              checked={form.costPriceUnit !== null}
              onChange={(e) => form.setCostPriceUnit(e.target.checked ? "PER_KG" : null)}
            />
            Calculate cost per variant by weight
          </label>
          {form.costPriceUnit && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-text">Rate is per</span>
              <select
                value={form.costPriceUnit}
                onChange={(e) => form.setCostPriceUnit(e.target.value as CostPriceUnit)}
                className={inputClass}
              >
                <option value="PER_KG">Kilogram</option>
                <option value="PER_100G">100 grams</option>
                <option value="PER_G">Gram</option>
              </select>
              <span className="text-xs text-muted">
                Each variant&apos;s cost = this rate × its own weight (set per variant in the Variants tab). Leave
                unchecked above for products where cost doesn&apos;t scale with weight (boxes, bundles, jars) — the
                cost price is then applied flat to every variant instead.
              </span>
            </label>
          )}
        </div>
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
