"use client";

import { useState } from "react";
import { StatusSelect } from "@/components/StatusSelect";
import { useAttributes, type Attribute } from "@/hooks/useAttributes";
import type { StockStatus, AdminProductVariant, VariantInput } from "@/hooks/useProducts";
import type { ProductFormState } from "./useProductFormState";
import { ProductMediaGallery } from "./ProductMediaGallery";
import { ProductTabs, type ProductTab } from "./ProductTabs";
import { ProductPricingCard } from "./ProductPricingCard";
import { ProductCategoriesTagsCard } from "./ProductCategoriesTagsCard";
import { RichTextEditor } from "./RichTextEditor";
import { ProductSeoTab } from "./ProductSeoTab";
import { ProductAnalyticsTab } from "./ProductAnalyticsTab";
import { ProductActivityTab } from "./ProductActivityTab";
import { CrossSellFields } from "./CrossSellFields";
import { ExistingVariantsManager } from "./ExistingVariantsManager";
import { NewVariantsBuilder } from "./NewVariantsBuilder";

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";
const numInputClass = `num ${inputClass}`;
const textareaClass = "rounded-sm border border-border bg-surface p-3 text-sm text-text outline-none focus:border-brand-500";

function toggle(list: number[], id: number, set: (ids: number[]) => void) {
  set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
}

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

  return (
    <div className="flex flex-col gap-4">
      <ProductTabs active={tab} onChange={setTab} />

      {tab === "General" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <div className="rounded-card border border-border bg-surface p-[18px]">
                <h3 className="mb-3.5 text-[0.9rem] font-extrabold text-text">Basic Information</h3>
                <label className="mb-3.5 flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-text">
                    Product Name<span className="ml-0.5 text-danger">*</span>
                  </span>
                  <input required value={form.name} onChange={(e) => form.setName(e.target.value)} className={inputClass} />
                </label>
                <label className="mb-3.5 flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-text">
                    Slug (URL)<span className="ml-0.5 text-danger">*</span>
                  </span>
                  <input required value={form.slug} onChange={(e) => form.setSlug(e.target.value)} className={inputClass} />
                </label>
                <label className="mb-3.5 flex flex-col gap-1.5">
                  <span className="flex items-center justify-between text-xs font-bold text-text">
                    Short Description
                    <span className="font-semibold text-muted">{form.description.length}/160</span>
                  </span>
                  <textarea value={form.description} onChange={(e) => form.setDescription(e.target.value)} rows={3} className={textareaClass} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-text">Full Description</span>
                  <RichTextEditor value={form.content} onChange={form.setContent} />
                </label>
              </div>

              <div className="rounded-card border border-border bg-surface p-[18px]">
                <h3 className="mb-3.5 text-[0.9rem] font-extrabold text-text">Other Details</h3>
                <div className="mb-3.5 grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-text">Nutrition (optional)</span>
                    <textarea value={form.nutrition} onChange={(e) => form.setNutrition(e.target.value)} rows={3} className={textareaClass} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-text">Ingredients (optional)</span>
                    <textarea value={form.ingredients} onChange={(e) => form.setIngredients(e.target.value)} rows={3} className={textareaClass} />
                  </label>
                </div>
                <label className="mb-3.5 flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-text">Key Benefits (optional, one per line, up to 4)</span>
                  <textarea value={form.keyBenefits} onChange={(e) => form.setKeyBenefits(e.target.value)} rows={4} className={textareaClass} />
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
            </div>

            <div className="flex flex-col gap-4">
              <ProductPricingCard form={form} />
              <ProductCategoriesTagsCard form={form} />
            </div>
          </div>

          {productId && <CrossSellFields productId={productId} />}
        </div>
      )}

      {tab === "Media" && (
        <div className="rounded-card border border-border bg-surface p-[18px]">
          <h3 className="mb-3.5 text-[0.9rem] font-extrabold text-text">Media</h3>
          <ProductMediaGallery images={form.images} onChange={form.setImages} />
          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-xs font-bold text-text">Video URL (optional)</span>
            <input value={form.videoUrl} onChange={(e) => form.setVideoUrl(e.target.value)} className={inputClass} />
          </label>
          <label className="mt-3.5 flex items-center gap-2 text-sm font-semibold text-text">
            <input type="checkbox" checked={form.isFeatured} onChange={(e) => form.setIsFeatured(e.target.checked)} className="accent-brand-500" />
            Featured
          </label>
        </div>
      )}

      {tab === "Inventory" && (
        <div className="rounded-card border border-border bg-surface p-[18px]">
          <h3 className="mb-3.5 text-[0.9rem] font-extrabold text-text">Inventory</h3>
          <div className="mb-3.5 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-text">SKU (optional)</span>
              <input value={form.sku} onChange={(e) => form.setSku(e.target.value)} className={inputClass} />
            </label>
          </div>
          {form.hasVariants ? (
            <p className="mb-3.5 text-sm text-muted">This product has variants — stock is tracked per variant in the Variants tab.</p>
          ) : (
            <div className="mb-3.5 grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-text">Stock</span>
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
                <ExistingVariantsManager productId={productId} attributes={selectedAttributes} variants={variants} />
              ) : (
                <NewVariantsBuilder attributes={selectedAttributes} variants={newVariants ?? []} onChange={onNewVariantsChange ?? (() => {})} />
              )}
            </>
          )}
        </div>
      )}

      {tab === "Shipping" && (
        <div className="rounded-card border border-border bg-surface p-[18px]">
          <h3 className="mb-3.5 text-[0.9rem] font-extrabold text-text">Shipping</h3>
          <div className="mb-3.5 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-text">Shippable weight, kg (optional)</span>
              <input type="number" value={form.shippableWeight} onChange={(e) => form.setShippableWeight(e.target.value)} className={numInputClass} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-text">Min order quantity</span>
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
          // The gallery only tracks {id,url} here, not alt text (no
          // alt-text editing UI exists in this form) — "has at least one
          // image" is the closest honest proxy available client-side;
          // the authoritative score on the product list is backend-computed
          // from the real Media.altText column.
          primaryImageAlt={form.images.length > 0 ? "has-image" : ""}
        />
      )}

      {tab === "Analytics" && (productId ? <ProductAnalyticsTab productId={productId} /> : <SaveFirstNotice />)}

      {tab === "Activity Logs" && (productId ? <ProductActivityTab productId={productId} /> : <SaveFirstNotice />)}
    </div>
  );
}
