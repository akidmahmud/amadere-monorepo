"use client";

import { StatusSelect } from "@/components/StatusSelect";
import { usePickerCategories, usePickerTags } from "@/hooks/usePickers";
import { useAttributes } from "@/hooks/useAttributes";
import { useBrands } from "@/hooks/useBrands";
import type { ProductType, StockStatus } from "@/hooks/useProducts";
import type { ProductFormState } from "./useProductFormState";
import { ProductMediaGallery } from "./ProductMediaGallery";

const inputClass =
  "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";
const numInputClass = `num ${inputClass}`;

export function ProductFormFields({ form }: { form: ProductFormState }) {
  const { data: brands } = useBrands();
  const { data: categories } = usePickerCategories();
  const { data: tags } = usePickerTags();
  const { data: attributes } = useAttributes();

  function toggle(list: number[], id: number, set: (ids: number[]) => void) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  return (
    <>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Name</span>
        <input required value={form.name} onChange={(e) => form.setName(e.target.value)} className={inputClass} />
      </label>
      <div className="flex gap-4">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Slug</span>
          <input required value={form.slug} onChange={(e) => form.setSlug(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">SKU (optional)</span>
          <input value={form.sku} onChange={(e) => form.setSku(e.target.value)} className={inputClass} />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Description (optional)</span>
        <textarea
          value={form.description}
          onChange={(e) => form.setDescription(e.target.value)}
          rows={3}
          className="rounded-sm border border-border bg-surface p-3 text-sm text-text outline-none focus:border-brand-500"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Content (optional, long-form)</span>
        <textarea
          value={form.content}
          onChange={(e) => form.setContent(e.target.value)}
          rows={4}
          className="rounded-sm border border-border bg-surface p-3 text-sm text-text outline-none focus:border-brand-500"
        />
      </label>
      <div className="flex gap-4">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Nutrition (optional)</span>
          <textarea
            value={form.nutrition}
            onChange={(e) => form.setNutrition(e.target.value)}
            rows={3}
            className="rounded-sm border border-border bg-surface p-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Ingredients (optional)</span>
          <textarea
            value={form.ingredients}
            onChange={(e) => form.setIngredients(e.target.value)}
            rows={3}
            className="rounded-sm border border-border bg-surface p-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">
          Key Benefits (optional, one per line — shown as the storefront's "Key Benefits" grid, up to 4)
        </span>
        <textarea
          value={form.keyBenefits}
          onChange={(e) => form.setKeyBenefits(e.target.value)}
          rows={4}
          className="rounded-sm border border-border bg-surface p-3 text-sm text-text outline-none focus:border-brand-500"
        />
      </label>

      <ProductMediaGallery images={form.images} onChange={form.setImages} />

      <div className="flex gap-4">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Brand (optional)</span>
          <select
            value={form.brandId ?? ""}
            onChange={(e) => form.setBrandId(e.target.value ? Number(e.target.value) : undefined)}
            className={inputClass}
          >
            <option value="">None</option>
            {brands?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.translations[0]?.name ?? b.slug}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Product type</span>
          <select
            value={form.productType}
            onChange={(e) => form.setProductType(e.target.value as ProductType)}
            className={inputClass}
          >
            <option value="PHYSICAL">Physical</option>
            <option value="DIGITAL">Digital</option>
          </select>
        </label>
      </div>

      <StatusSelect value={form.status} onChange={form.setStatus} />
      <label className="flex items-center gap-2 text-sm text-text">
        <input type="checkbox" checked={form.isFeatured} onChange={(e) => form.setIsFeatured(e.target.checked)} />
        Featured
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Video URL (optional)</span>
        <input value={form.videoUrl} onChange={(e) => form.setVideoUrl(e.target.value)} className={inputClass} />
      </label>

      <div>
        <span className="mb-2 block text-xs font-semibold text-secondary">Categories</span>
        <div className="flex flex-wrap gap-2">
          {categories?.map((c) => (
            <label key={c.id} className="flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-xs text-text">
              <input
                type="checkbox"
                checked={form.categoryIds.includes(c.id)}
                onChange={() => toggle(form.categoryIds, c.id, form.setCategoryIds)}
              />
              {c.label}
            </label>
          ))}
        </div>
      </div>
      <div>
        <span className="mb-2 block text-xs font-semibold text-secondary">Tags</span>
        <div className="flex flex-wrap gap-2">
          {tags?.map((t) => (
            <label key={t.id} className="flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-xs text-text">
              <input
                type="checkbox"
                checked={form.tagIds.includes(t.id)}
                onChange={() => toggle(form.tagIds, t.id, form.setTagIds)}
              />
              {t.label}
            </label>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-text">
        <input type="checkbox" checked={form.hasVariants} onChange={(e) => form.setHasVariants(e.target.checked)} />
        This product has variants (price/stock live on each variant instead)
      </label>

      {!form.hasVariants && (
        <>
          <div className="flex gap-4">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Price</span>
              <input
                type="number"
                required={!form.hasVariants}
                value={form.price}
                onChange={(e) => form.setPrice(e.target.value)}
                className={numInputClass}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Sale price (optional)</span>
              <input
                type="number"
                value={form.salePrice}
                onChange={(e) => form.setSalePrice(e.target.value)}
                className={numInputClass}
              />
            </label>
          </div>
          <div className="flex gap-4">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Sale starts (optional)</span>
              <input type="date" value={form.saleStartsAt} onChange={(e) => form.setSaleStartsAt(e.target.value)} className={inputClass} />
            </label>
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Sale ends (optional)</span>
              <input type="date" value={form.saleEndsAt} onChange={(e) => form.setSaleEndsAt(e.target.value)} className={inputClass} />
            </label>
          </div>
          <div className="flex gap-4">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Stock</span>
              <input type="number" value={form.stock} onChange={(e) => form.setStock(e.target.value)} className={numInputClass} />
            </label>
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Stock status</span>
              <select value={form.stockStatus} onChange={(e) => form.setStockStatus(e.target.value as StockStatus)} className={inputClass}>
                <option value="IN_STOCK">In stock</option>
                <option value="OUT_OF_STOCK">Out of stock</option>
                <option value="ON_BACKORDER">On backorder</option>
              </select>
            </label>
          </div>
        </>
      )}

      <div>
        <span className="mb-2 block text-xs font-semibold text-secondary">
          Variant attributes (which properties this product varies by)
        </span>
        <div className="flex flex-wrap gap-2">
          {attributes?.map((a) => (
            <label key={a.id} className="flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-xs text-text">
              <input
                type="checkbox"
                checked={form.attributeIds.includes(a.id)}
                onChange={() => toggle(form.attributeIds, a.id, form.setAttributeIds)}
              />
              {a.translations[0]?.name}
            </label>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-text">
        <input type="checkbox" checked={form.trackInventory} onChange={(e) => form.setTrackInventory(e.target.checked)} />
        Track inventory
      </label>
      <label className="flex items-center gap-2 text-sm text-text">
        <input type="checkbox" checked={form.allowBackorder} onChange={(e) => form.setAllowBackorder(e.target.checked)} />
        Allow backorder
      </label>

      <div className="flex gap-4">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Cost per item (optional)</span>
          <input type="number" value={form.costPerItem} onChange={(e) => form.setCostPerItem(e.target.value)} className={numInputClass} />
        </label>
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Shippable weight, kg (optional)</span>
          <input type="number" value={form.shippableWeight} onChange={(e) => form.setShippableWeight(e.target.value)} className={numInputClass} />
        </label>
      </div>
      <div className="flex gap-4">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Min order quantity</span>
          <input type="number" value={form.minOrderQuantity} onChange={(e) => form.setMinOrderQuantity(e.target.value)} className={numInputClass} />
        </label>
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Max order quantity (optional)</span>
          <input type="number" value={form.maxOrderQuantity} onChange={(e) => form.setMaxOrderQuantity(e.target.value)} className={numInputClass} />
        </label>
      </div>
    </>
  );
}
