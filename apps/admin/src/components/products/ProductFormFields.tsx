"use client";

import { useRef, useState } from "react";
import { StatusSelect } from "@/components/StatusSelect";
import { useAttributes, type Attribute } from "@/hooks/useAttributes";
import { useStorefrontUrl } from "@/hooks/useStorefrontUrl";
import type { StockStatus, AdminProductVariant, VariantInput } from "@/hooks/useProducts";
import type { ProductFormState } from "./useProductFormState";
import { ProductMediaGallery } from "./ProductMediaGallery";
import { ProductTabs, type ProductTab } from "./ProductTabs";
import { ProductPricingCard } from "./ProductPricingCard";
import { ProductCategoriesTagsCard } from "./ProductCategoriesTagsCard";
import { ProductFaqCard } from "./ProductFaqCard";
import { ProductBadgesField } from "./ProductBadgesField";
import { RichTextEditor } from "@/components/RichTextEditor";
import { ProductSeoTab } from "./ProductSeoTab";
import { ProductAnalyticsTab } from "./ProductAnalyticsTab";
import { ProductActivityTab } from "./ProductActivityTab";
import { CrossSellFields } from "./CrossSellFields";
import { FrequentlyBoughtTogetherFields } from "./FrequentlyBoughtTogetherFields";
import { ExistingVariantsManager } from "./ExistingVariantsManager";
import { NewVariantsBuilder } from "./NewVariantsBuilder";

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";
const numInputClass = `num ${inputClass}`;
const textareaClass = "rounded-sm border border-border bg-surface p-3 text-sm text-text outline-none focus:border-brand-500";

function toggle(list: number[], id: number, set: (ids: number[]) => void) {
  set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
}

// Short Description is plain text typed by an admin, but products migrated
// from the old WooCommerce catalog can carry a literal "<p>...</p>" wrapper
// in the raw string — counting those tag characters against the 350 cap
// both inflates the displayed count and eats into the actual usable length.
function stripHtml(str: string): string {
  return str.replace(/<[^>]+>/g, "");
}

// Product names in this catalog are commonly bilingual — "Amader Fiber Mix
// ( আমাদের ফাইবার মিক্স )" or "Name | বাংলা নাম" — and the slug should come
// from the English part only, not a mixed-script URL. Strips parenthetical
// and pipe-separated segments, then keeps ASCII letters/numbers only. Falls
// back to a Unicode-aware slug (keeps non-Latin letters) if that leaves
// nothing, so a Bangla-only name still gets *some* slug instead of "".
function slugify(str: string): string {
  const ascii = str
    .replace(/\([^)]*\)/g, " ")
    .split("|")[0]
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  if (ascii) return ascii;
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

const wandIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 4 1.5 3L20 8.5 16.5 10 15 13l-1.5-3L10 8.5 13.5 7Z" />
    <path d="m5 14 .9 1.8L8 16.7l-2.1.9L5 19.5l-.9-1.9-2.1-.9 2.1-.9Z" />
    <path d="M3 3v3M1.5 4.5h3" />
  </svg>
);

function SaveFirstNotice() {
  return (
    <div className="rounded-card border border-border bg-surface p-[18px] text-sm text-muted">
      Save the product first — this tab needs a real product ID.
    </div>
  );
}

export interface ProductFormFieldsProps {
  form: ProductFormState;
  /** Undefined on the New Product page — several tabs (SEO, Analytics, Activity Logs, Cross-sell) need a real ID. */
  productId?: number;
  /** Editing an existing product's variants (immediate add/remove/edit calls). */
  variants?: AdminProductVariant[];
  /** Building a new product's variants as local state (sent as one array on create). */
  newVariants?: VariantInput[];
  onNewVariantsChange?: (variants: VariantInput[]) => void;
}

export function ProductFormFields({ form, productId, variants, newVariants, onNewVariantsChange }: ProductFormFieldsProps) {
  const [tab, setTab] = useState<ProductTab>("General");
  const { data: attributes } = useAttributes();
  const selectedAttributes: Attribute[] = (attributes ?? []).filter((a) => form.attributeIds.includes(a.id));
  // Auto-generates the slug from the name until the admin types into the
  // slug field directly — same pattern as BlogPostFormFields.tsx.
  const slugEdited = useRef(false);
  const storefrontUrl = useStorefrontUrl();
  // undefined (not 0) means "no cost entered" — same distinction
  // ProductPricingCard's own hasCost flag makes, so a variant with no cost
  // basis shows "—" instead of a misleading ৳0 profit.
  const variantCostPerItem = form.costPerItem.trim() !== "" ? Number(form.costPerItem) : undefined;

  function handleNameChange(v: string) {
    form.setName(v);
    if (!slugEdited.current) form.setSlug(slugify(v));
  }

  return (
    <div className="flex flex-col gap-4">
      <ProductTabs active={tab} onChange={setTab} />

      {tab === "General" && (
        <div className="flex flex-col gap-4">
          {/* minmax(0, Nfr), not a bare Nfr — a bare fr track's implicit
              minimum is its content's min-content width (same root cause as
              the classic flexbox min-width:auto overflow bug), and the
              CKEditor toolbar's min-content is wide enough to blow straight
              through its nominal 70% share, starving the Pricing column
              down to whatever's left over instead of an actual 70/30 split. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
            <div className="flex flex-col gap-4">
              <div className="rounded-card border border-border bg-surface p-[18px]">
                <h3 className="mb-3.5 text-[0.9rem] font-extrabold text-text">Basic Information</h3>
                <label className="mb-3.5 flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-text">
                    Product Name<span className="ml-0.5 text-danger">*</span>
                  </span>
                  <input value={form.name} onChange={(e) => handleNameChange(e.target.value)} className={inputClass} />
                </label>
                <label className="mb-3.5 flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-text">
                    Permalink<span className="ml-0.5 text-danger">*</span>
                  </span>
                  <div className="flex h-10 items-center overflow-hidden rounded-sm border border-border bg-surface focus-within:border-brand-500">
                    <span className="select-none whitespace-nowrap pl-3 text-sm text-muted">{storefrontUrl}/products/</span>
                    <input
                      value={form.slug}
                      onChange={(e) => {
                        slugEdited.current = true;
                        form.setSlug(e.target.value);
                      }}
                      spellCheck={false}
                      autoCapitalize="off"
                      autoCorrect="off"
                      autoComplete="off"
                      className="h-full min-w-0 flex-1 border-0 bg-transparent pr-2 text-sm font-semibold text-text outline-none"
                    />
                    <button
                      type="button"
                      title="Regenerate from product name"
                      onClick={() => {
                        slugEdited.current = false;
                        form.setSlug(slugify(form.name));
                      }}
                      className="grid h-full w-10 flex-none place-items-center text-muted transition-colors hover:text-brand-500"
                    >
                      {wandIcon}
                    </button>
                  </div>
                  {form.slug && (
                    <span className="text-xs text-muted">
                      Preview:{" "}
                      <a href={`${storefrontUrl}/products/${form.slug}`} target="_blank" rel="noreferrer" className="text-brand-500 hover:underline">
                        {storefrontUrl}/products/{form.slug}
                      </a>
                    </span>
                  )}
                </label>
                <label className="mb-3.5 flex flex-col gap-1.5">
                  <span className="flex items-center justify-between text-xs font-bold text-text">
                    Short Description
                    <span className="font-semibold text-muted">{stripHtml(form.description).length}/350</span>
                  </span>
                  <textarea
                    value={form.description}
                    onChange={(e) => {
                      if (stripHtml(e.target.value).length <= 350) form.setDescription(e.target.value);
                    }}
                    rows={3}
                    className={textareaClass}
                  />
                </label>
                {/* A plain div, not <label> — RichTextEditor renders its own
                    toolbar full of buttons, and a bare <label> with no
                    htmlFor wrapping multiple interactive elements makes the
                    browser synthesize a click on the first one (the
                    Fullscreen button) whenever anything inside is clicked,
                    including the editor's own content area. */}
                <div className="mb-3.5 flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-text">Full Description</span>
                  <RichTextEditor value={form.content} onChange={form.setContent} />
                </div>
                <label className="mb-3.5 flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-text">Key Benefits (optional — rendered as a checklist on the product page)</span>
                  <textarea value={form.benefitPoints} onChange={(e) => form.setBenefitPoints(e.target.value)} rows={4} className={textareaClass} placeholder="One benefit per line" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-text">How to Use (optional)</span>
                  <textarea value={form.howToUse} onChange={(e) => form.setHowToUse(e.target.value)} rows={3} className={textareaClass} />
                </label>
              </div>

              <div className="rounded-card border border-border bg-surface p-[18px]">
                <h3 className="mb-3.5 text-[0.9rem] font-extrabold text-text">Other Details</h3>
                <label className="mb-3.5 flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-text">Badges (optional, up to 5 — shown under the buy box, including on mobile)</span>
                  <ProductBadgesField value={form.keyBenefits} onChange={form.setKeyBenefits} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <StatusSelect value={form.status} onChange={form.setStatus} />
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-text">Product type</span>
                    <select value={form.productType} onChange={(e) => form.setProductType(e.target.value as typeof form.productType)} className={inputClass}>
                      <option value="PHYSICAL">Physical</option>
                      <option value="DIGITAL">Digital</option>
                    </select>
                  </label>
                </div>
              </div>

              <ProductFaqCard form={form} />
            </div>

            <div className="flex flex-col gap-4">
              <ProductPricingCard form={form} />
              <ProductCategoriesTagsCard form={form} />
            </div>
          </div>

          {productId && <CrossSellFields productId={productId} />}
          {productId && <FrequentlyBoughtTogetherFields productId={productId} />}
        </div>
      )}

      {tab === "Media" && (
        <div className="rounded-card border border-border bg-surface p-[18px]">
          <h3 className="mb-3.5 text-[0.9rem] font-extrabold text-text">
            Media<span className="ml-0.5 text-danger">*</span>
          </h3>
          <ProductMediaGallery images={form.images} onChange={form.setImages} />
          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-xs font-bold text-text">Video URL (optional)</span>
            <input value={form.videoUrl} onChange={(e) => form.setVideoUrl(e.target.value)} className={inputClass} />
          </label>
          <label className="mt-3.5 flex items-center gap-2 text-sm font-semibold text-text">
            <input type="checkbox" checked={form.isFeatured} onChange={(e) => form.setIsFeatured(e.target.checked)} className="accent-brand-500" />
            Featured
          </label>
          <label className="mt-3.5 flex flex-col gap-1.5">
            <span className="text-xs font-bold text-text">Product Badge (optional)</span>
            <select
              value={form.flagLabel ?? ""}
              onChange={(e) => form.setFlagLabel(e.target.value === "" ? null : (e.target.value as typeof form.flagLabel))}
              className={inputClass}
            >
              <option value="">None</option>
              <option value="BEST_SELLING">Best Selling</option>
              <option value="NEW_ARRIVAL">New Arrival</option>
              <option value="FEATURED">Featured</option>
            </select>
          </label>
        </div>
      )}

      {tab === "Inventory" && (
        <div className="rounded-card border border-border bg-surface p-[18px]">
          <h3 className="mb-3.5 text-[0.9rem] font-extrabold text-text">Inventory</h3>
          <div className="mb-3.5 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-text">
                SKU<span className="ml-0.5 text-danger">*</span>
              </span>
              <input value={form.sku} onChange={(e) => form.setSku(e.target.value)} className={inputClass} />
            </label>
          </div>
          {form.hasVariants ? (
            <p className="mb-3.5 text-sm text-muted">This product has variants — stock is tracked per variant in the Variants tab.</p>
          ) : (
            <div className="mb-3.5 grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-text">
                  Stock<span className="ml-0.5 text-danger">*</span>
                </span>
                <input type="number" value={form.stock} onChange={(e) => form.setStock(e.target.value)} className={numInputClass} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-text">Stock status</span>
                <select value={form.stockStatus} onChange={(e) => form.setStockStatus(e.target.value as StockStatus)} className={inputClass}>
                  <option value="IN_STOCK">In stock</option>
                  <option value="OUT_OF_STOCK">Out of stock</option>
                  <option value="ON_BACKORDER">On backorder</option>
                </select>
              </label>
            </div>
          )}
          <label className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-text">
            <input type="checkbox" checked={form.trackInventory} onChange={(e) => form.setTrackInventory(e.target.checked)} className="accent-brand-500" />
            Track inventory
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-text">
            <input type="checkbox" checked={form.allowBackorder} onChange={(e) => form.setAllowBackorder(e.target.checked)} className="accent-brand-500" />
            Allow backorder
          </label>
        </div>
      )}

      {tab === "Variants" && (
        <div className="rounded-card border border-border bg-surface p-[18px]">
          <h3 className="mb-3.5 text-[0.9rem] font-extrabold text-text">Variants</h3>
          <label className="mb-3.5 flex items-center gap-2 text-sm font-semibold text-text">
            <input type="checkbox" checked={form.hasVariants} onChange={(e) => form.setHasVariants(e.target.checked)} className="accent-brand-500" />
            This product has variants (price/stock live on each variant instead)
          </label>

          {form.hasVariants && (
            <>
              <div className="mb-3.5">
                <span className="mb-2 block text-xs font-bold text-text">Variant attributes (which properties this product varies by)</span>
                <div className="flex flex-wrap gap-2">
                  {attributes?.map((a) => (
                    <label key={a.id} className="flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text">
                      <input type="checkbox" checked={form.attributeIds.includes(a.id)} onChange={() => toggle(form.attributeIds, a.id, form.setAttributeIds)} className="accent-brand-500" />
                      {a.translations[0]?.name}
                    </label>
                  ))}
                </div>
              </div>

              {productId && variants ? (
                <ExistingVariantsManager productId={productId} attributes={selectedAttributes} variants={variants} costPerItem={variantCostPerItem} />
              ) : (
                <NewVariantsBuilder attributes={selectedAttributes} variants={newVariants ?? []} onChange={onNewVariantsChange ?? (() => {})} costPerItem={variantCostPerItem} />
              )}
            </>
          )}
        </div>
      )}

      {tab === "Shipping" && (
        <div className="rounded-card border border-border bg-surface p-[18px]">
          <h3 className="mb-3.5 text-[0.9rem] font-extrabold text-text">Shipping</h3>
          {/* How courier weight is actually calculated (shipments.service.ts):
              a variant's own weightOverride is used when it has one; only
              when it doesn't does the product-level Shippable weight below
              step in as the fallback. Written out for admins in both
              languages since it's not obvious from the field alone, and this
              is the one place in the form where "why does this number
              matter" needed explaining. */}
          <div
            className="mb-3.5 flex flex-col gap-2 rounded-sm px-3 py-2.5 text-xs"
            style={{ background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}
          >
            <p>
              <strong>Same value as &quot;Weight (kg)&quot; on the General tab (Pricing)</strong> — editing either one
              updates both. For products with variants: each variant can have its own shipping weight (set per
              variant in the Variants tab); when a variant doesn&apos;t have one, this product-level weight is used
              for it instead when the courier shipment is calculated.
            </p>
            <p lang="bn">
              <strong>জেনারেল ট্যাবের (প্রাইসিং) &quot;Weight (kg)&quot; ফিল্ডের সাথে এটি একই মান</strong> — যেকোনো
              একটিতে পরিবর্তন করলে দুটোই আপডেট হয়। ভ্যারিয়েন্ট থাকা পণ্যের ক্ষেত্রে: প্রতিটি ভ্যারিয়েন্টের নিজস্ব
              শিপিং ওজন থাকতে পারে (ভ্যারিয়েন্টস ট্যাবে সেট করা যায়); কোনো ভ্যারিয়েন্টের নিজস্ব ওজন সেট না থাকলে,
              কুরিয়ার শিপমেন্ট হিসাব করার সময় এই প্রোডাক্ট-লেভেল ওজনটি সেই ভ্যারিয়েন্টের জন্য ব্যবহৃত হবে।
            </p>
          </div>
          {/* Also editable from the Pricing card on the General tab (same
              state) — surfaced there too since it's easy to miss tucked away
              in this tab, and it's a required field. */}
          <div className="mb-3.5 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-text">
                Shippable weight, kg<span className="ml-0.5 text-danger">*</span>
              </span>
              <input type="number" value={form.shippableWeight} onChange={(e) => form.setShippableWeight(e.target.value)} className={numInputClass} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-text">
                Min order quantity<span className="ml-0.5 text-danger">*</span>
              </span>
              <input type="number" value={form.minOrderQuantity} onChange={(e) => form.setMinOrderQuantity(e.target.value)} className={numInputClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-text">Max order quantity (optional)</span>
              <input type="number" value={form.maxOrderQuantity} onChange={(e) => form.setMaxOrderQuantity(e.target.value)} className={numInputClass} />
            </label>
          </div>
        </div>
      )}

      {tab === "SEO" && (
        <ProductSeoTab
          productId={productId}
          slug={form.slug}
          name={form.name}
          description={form.description}
          primaryImageAlt={form.images[0]?.alt ?? ""}
        />
      )}

      {tab === "Analytics" && (productId ? <ProductAnalyticsTab productId={productId} /> : <SaveFirstNotice />)}

      {tab === "Activity Logs" && (productId ? <ProductActivityTab productId={productId} /> : <SaveFirstNotice />)}
    </div>
  );
}
