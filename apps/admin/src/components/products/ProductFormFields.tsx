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

function toggle(list: number[], id: number, set: (ids: number[]) => void) {
  set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
}

export const SHORT_DESCRIPTION_MAX_WORDS = 450;

// Short Description is HTML (compact RichTextEditor — bold/italic/underline/
// link only), same as products migrated from the old WooCommerce/Botble
// catalog which can carry literal HTML tags ("<p>...", "<span>...") or HTML
// entities in the raw string — stripping tags & entities either way ensures
// markup is never counted as words against the length limit (word count,
// not character count, matching CategoryFormFields.tsx's own convention).
function stripHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(str: string): number {
  const plainText = stripHtml(str);
  if (!plainText) return 0;
  return plainText.split(/\s+/).filter(Boolean).length;
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
    <div className="flex items-center gap-3 rounded-xl border border-emerald-800/20 bg-gradient-to-r from-emerald-50 via-white to-amber-50/40 p-5 text-sm font-semibold text-emerald-900 shadow-sm">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-400/20 text-amber-700 ring-1 ring-amber-400/40">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </span>
      <span>Save the product first — this tab needs a real product ID.</span>
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
                <div className="mb-3.5 flex flex-col gap-1.5">
                  <span className="flex items-center justify-between text-xs font-bold text-text">
                    Short Description
                    <span className={countWords(form.description) > SHORT_DESCRIPTION_MAX_WORDS ? "font-semibold text-danger" : "font-semibold text-muted"}>
                      {countWords(form.description)}/{SHORT_DESCRIPTION_MAX_WORDS} words
                    </span>
                  </span>
                  <RichTextEditor value={form.description} onChange={form.setDescription} compact />
                  {countWords(form.description) > SHORT_DESCRIPTION_MAX_WORDS && (
                    <span className="text-xs font-semibold text-danger">
                      Short description exceeds {SHORT_DESCRIPTION_MAX_WORDS} words by {countWords(form.description) - SHORT_DESCRIPTION_MAX_WORDS} word(s). Please trim to save.
                    </span>
                  )}
                </div>
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
                {/* Plain div, not <label> — see the Full Description field's
                    own comment above for why (RichTextEditor's toolbar has
                    multiple buttons; a wrapping <label> would hijack every
                    click in it to the first one). Full (non-compact) editor,
                    not the short-field compact one — Key Benefits needs
                    Heading (for benefit groups) and bulleted List (for both
                    the benefit points and any usage-idea sub-lists), neither
                    of which the compact toolbar carries. */}
                <div className="mb-3.5 flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-text">Key Benefits (optional)</span>
                  <RichTextEditor value={form.benefitPoints} onChange={form.setBenefitPoints} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-text">How to Use (optional)</span>
                  <RichTextEditor value={form.howToUse} onChange={form.setHowToUse} />
                </div>
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
        <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-xs">
          <h3 className="mb-5 flex items-center gap-2.5 text-base font-extrabold text-[#064e3b]">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#ecfdf5] text-[#059669]">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </span>
            <span>Media</span>
            <span className="text-[#f43f5e]">*</span>
          </h3>
          <ProductMediaGallery images={form.images} onChange={form.setImages} />
          <label className="mt-5 flex flex-col gap-1.5">
            <span className="text-xs font-bold text-emerald-950">Video URL (optional)</span>
            <input
              value={form.videoUrl}
              onChange={(e) => form.setVideoUrl(e.target.value)}
              className="h-10 rounded-lg border border-emerald-800/20 bg-white px-3 text-sm font-semibold text-emerald-950 outline-none transition-all duration-150 focus:border-emerald-600 focus:ring-2 focus:ring-amber-400/30 placeholder:text-emerald-900/40"
              placeholder="https://youtube.com/..."
            />
          </label>
          <label className="mt-4 flex items-center gap-2.5 text-sm font-bold text-emerald-950 cursor-pointer select-none">
            <input type="checkbox" checked={form.isFeatured} onChange={(e) => form.setIsFeatured(e.target.checked)} className="h-4 w-4 rounded accent-emerald-700" />
            Featured Product
          </label>
          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-xs font-bold text-emerald-950">Product Badge (optional)</span>
            <select
              value={form.flagLabel ?? ""}
              onChange={(e) => form.setFlagLabel(e.target.value === "" ? null : (e.target.value as typeof form.flagLabel))}
              className="h-10 rounded-lg border border-emerald-800/20 bg-white px-3 text-sm font-semibold text-emerald-950 outline-none transition-all duration-150 focus:border-emerald-600 focus:ring-2 focus:ring-amber-400/30"
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
        <div className="rounded-xl border border-emerald-800/20 bg-gradient-to-b from-white via-white to-emerald-50/20 p-6 shadow-sm">
          <h3 className="mb-4 text-[0.95rem] font-extrabold text-emerald-950 flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-emerald-800/10 text-emerald-800">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                <path d="m3.3 7 8.7 5 8.7-5" />
                <path d="M12 22V12" />
              </svg>
            </span>
            Inventory Management
          </h3>
          <div className="mb-4 grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-emerald-950">
                SKU<span className="ml-0.5 text-rose-500">*</span>
              </span>
              <input
                value={form.sku}
                onChange={(e) => form.setSku(e.target.value)}
                className="h-10 rounded-lg border border-emerald-800/20 bg-white px-3 text-sm font-semibold text-emerald-950 outline-none transition-all duration-150 focus:border-emerald-600 focus:ring-2 focus:ring-amber-400/30"
              />
            </label>
          </div>
          {form.hasVariants ? (
            <div className="mb-4 rounded-lg border border-amber-400/40 bg-gradient-to-r from-amber-500/10 to-amber-400/5 p-3.5 text-xs font-semibold text-amber-900">
              This product has variants — stock is tracked per variant in the <strong>Variants</strong> tab.
            </div>
          ) : (
            <div className="mb-4 grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-emerald-950">
                  Stock<span className="ml-0.5 text-rose-500">*</span>
                </span>
                <input
                  type="number"
                  value={form.stock}
                  onChange={(e) => form.setStock(e.target.value)}
                  className="num h-10 rounded-lg border border-emerald-800/20 bg-white px-3 text-sm font-semibold text-emerald-950 outline-none transition-all duration-150 focus:border-emerald-600 focus:ring-2 focus:ring-amber-400/30"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-emerald-950">Stock status</span>
                <select
                  value={form.stockStatus}
                  onChange={(e) => form.setStockStatus(e.target.value as StockStatus)}
                  className="h-10 rounded-lg border border-emerald-800/20 bg-white px-3 text-sm font-semibold text-emerald-950 outline-none transition-all duration-150 focus:border-emerald-600 focus:ring-2 focus:ring-amber-400/30"
                >
                  <option value="IN_STOCK">In stock</option>
                  <option value="OUT_OF_STOCK">Out of stock</option>
                  <option value="ON_BACKORDER">On backorder</option>
                </select>
              </label>
            </div>
          )}
          <div className="flex flex-col gap-3 pt-1">
            <label className="flex items-center gap-2.5 text-sm font-bold text-emerald-950 cursor-pointer select-none">
              <input type="checkbox" checked={form.trackInventory} onChange={(e) => form.setTrackInventory(e.target.checked)} className="h-4 w-4 rounded accent-emerald-700" />
              Track inventory
            </label>
            <label className="flex items-center gap-2.5 text-sm font-bold text-emerald-950 cursor-pointer select-none">
              <input type="checkbox" checked={form.allowBackorder} onChange={(e) => form.setAllowBackorder(e.target.checked)} className="h-4 w-4 rounded accent-emerald-700" />
              Allow backorder
            </label>
          </div>
        </div>
      )}

      {tab === "Variants" && (
        <div className="rounded-xl border border-emerald-800/20 bg-gradient-to-b from-white via-white to-emerald-50/20 p-6 shadow-sm">
          <h3 className="mb-4 text-[0.95rem] font-extrabold text-emerald-950 flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-emerald-800/10 text-emerald-800">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </span>
            Product Variants
          </h3>
          <label className="mb-5 flex items-center gap-2.5 text-sm font-bold text-emerald-950 cursor-pointer select-none rounded-lg border border-emerald-800/15 bg-white p-3 shadow-xs">
            <input type="checkbox" checked={form.hasVariants} onChange={(e) => form.setHasVariants(e.target.checked)} className="h-4 w-4 rounded accent-emerald-700" />
            This product has variants (price/stock live on each variant instead)
          </label>

          {form.hasVariants && (
            <>
              <div className="mb-5 rounded-lg border border-emerald-800/15 bg-emerald-50/40 p-4">
                <span className="mb-2.5 block text-xs font-extrabold text-emerald-950">Variant attributes (which properties this product varies by)</span>
                <div className="flex flex-wrap gap-2">
                  {attributes?.map((a) => {
                    const checked = form.attributeIds.includes(a.id);
                    return (
                      <label
                        key={a.id}
                        className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer select-none ${
                          checked
                            ? "border-amber-400 bg-gradient-to-r from-emerald-800 to-emerald-900 text-amber-300 shadow-sm ring-1 ring-amber-400/40"
                            : "border-emerald-800/20 bg-white text-emerald-950 hover:border-emerald-600/40"
                        }`}
                      >
                        <input type="checkbox" checked={checked} onChange={() => toggle(form.attributeIds, a.id, form.setAttributeIds)} className="accent-amber-400" />
                        {a.translations[0]?.name}
                      </label>
                    );
                  })}
                </div>
              </div>

              {productId && variants ? (
                <ExistingVariantsManager
                  productId={productId}
                  attributes={selectedAttributes}
                  variants={variants}
                  costPerItem={variantCostPerItem}
                  costPriceUnit={form.costPriceUnit}
                />
              ) : (
                <NewVariantsBuilder
                  attributes={selectedAttributes}
                  variants={newVariants ?? []}
                  onChange={onNewVariantsChange ?? (() => {})}
                  costPerItem={variantCostPerItem}
                  costPriceUnit={form.costPriceUnit}
                />
              )}
            </>
          )}
        </div>
      )}

      {tab === "Shipping" && (
        <div className="rounded-xl border border-emerald-800/20 bg-gradient-to-b from-white via-white to-emerald-50/20 p-6 shadow-sm">
          <h3 className="mb-4 text-[0.95rem] font-extrabold text-emerald-950 flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-emerald-800/10 text-emerald-800">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <rect x="1" y="3" width="15" height="13" />
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
            </span>
            Shipping & Fulfillment
          </h3>
          <div className="mb-4 flex flex-col gap-2 rounded-xl border border-emerald-800/20 bg-gradient-to-r from-emerald-50 via-white to-amber-50/50 p-4 text-xs text-emerald-950 shadow-xs">
            <div className="flex items-center gap-2 font-bold text-emerald-900">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-amber-400 text-emerald-950 font-black text-[10px]">i</span>
              <span>Courier Weight Calculation Rules</span>
            </div>
            <p className="leading-relaxed">
              <strong>Same value as &quot;Weight (kg)&quot; on the General tab (Pricing)</strong> — editing either one
              updates both. For products with variants: each variant can have its own shipping weight (set per
              variant in the Variants tab); when a variant doesn&apos;t have one, this product-level weight is used
              for it instead when the courier shipment is calculated.
            </p>
            <p lang="bn" className="leading-relaxed text-emerald-900/90">
              <strong>জেনারেল ট্যাবের (প্রাইসিং) &quot;Weight (kg)&quot; ফিল্ডের সাথে এটি একই মান</strong> — যেকোনো
              একটিতে পরিবর্তন করলে দুটোই আপডেট হয়। ভ্যারিয়েন্ট থাকা পণ্যের ক্ষেত্রে: প্রতিটি ভ্যারিয়েন্টের নিজস্ব
              শিপিং ওজন থাকতে পারে (ভ্যারিয়েন্টস ট্যাবে সেট করা যায়); কোনো ভ্যারিয়েন্টের নিজস্ব ওজন সেট না থাকলে,
              কুরিয়ার শিপমেন্ট হিসাব করার সময় এই প্রোডাক্ট-লেভেল ওজনটি সেই ভ্যারিয়েন্টের জন্য ব্যবহৃত হবে।
            </p>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-emerald-950">
                Shippable weight, kg<span className="ml-0.5 text-rose-500">*</span>
              </span>
              <input
                type="number"
                value={form.shippableWeight}
                onChange={(e) => form.setShippableWeight(e.target.value)}
                className="num h-10 rounded-lg border border-emerald-800/20 bg-white px-3 text-sm font-semibold text-emerald-950 outline-none transition-all duration-150 focus:border-emerald-600 focus:ring-2 focus:ring-amber-400/30"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-emerald-950">
                Min order quantity<span className="ml-0.5 text-rose-500">*</span>
              </span>
              <input
                type="number"
                value={form.minOrderQuantity}
                onChange={(e) => form.setMinOrderQuantity(e.target.value)}
                className="num h-10 rounded-lg border border-emerald-800/20 bg-white px-3 text-sm font-semibold text-emerald-950 outline-none transition-all duration-150 focus:border-emerald-600 focus:ring-2 focus:ring-amber-400/30"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-emerald-950">Max order quantity (optional)</span>
              <input
                type="number"
                value={form.maxOrderQuantity}
                onChange={(e) => form.setMaxOrderQuantity(e.target.value)}
                className="num h-10 rounded-lg border border-emerald-800/20 bg-white px-3 text-sm font-semibold text-emerald-950 outline-none transition-all duration-150 focus:border-emerald-600 focus:ring-2 focus:ring-amber-400/30"
              />
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
