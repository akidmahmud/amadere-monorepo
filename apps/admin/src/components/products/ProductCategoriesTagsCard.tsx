"use client";

import { useState } from "react";
import { usePickerCategories, usePickerTags } from "@/hooks/usePickers";
import { useBrands } from "@/hooks/useBrands";
import type { ProductFormState } from "./useProductFormState";

const selectClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm font-semibold text-ink outline-none focus:border-brand-500";

function toggle(list: number[], id: number, set: (ids: number[]) => void) {
  set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
}

export function ProductCategoriesTagsCard({ form }: { form: ProductFormState }) {
  const { data: categories } = usePickerCategories();
  const { data: tags } = usePickerTags();
  const { data: brands } = useBrands();
  const [tagSearch, setTagSearch] = useState("");

  const selectedTags = (tags ?? []).filter((t) => form.tagIds.includes(t.id));
  const filteredTags = (tags ?? []).filter((t) => t.label.toLowerCase().includes(tagSearch.trim().toLowerCase()));

  return (
    <div className="rounded-card border border-border bg-surface p-[18px]">
      <h3 className="mb-3.5 text-[0.9rem] font-extrabold text-text">Categories &amp; Tags</h3>

      <div className="mb-3.5">
        <span className="mb-2 block text-xs font-bold text-text">
          Category<span className="ml-0.5 text-danger">*</span>
        </span>
        <div className="flex flex-wrap gap-2">
          {categories?.map((c) => (
            <label key={c.id} className="flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text">
              <input type="checkbox" checked={form.categoryIds.includes(c.id)} onChange={() => toggle(form.categoryIds, c.id, form.setCategoryIds)} className="accent-brand-500" />
              {c.label}
            </label>
          ))}
        </div>
      </div>

      <label className="mb-3.5 flex flex-col gap-1.5">
        <span className="text-xs font-bold text-text">Brand (optional)</span>
        <select value={form.brandId ?? ""} onChange={(e) => form.setBrandId(e.target.value ? Number(e.target.value) : undefined)} className={selectClass}>
          <option value="">None</option>
          {brands?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.translations[0]?.name ?? b.slug}
            </option>
          ))}
        </select>
      </label>

      <div>
        <span className="mb-2 block text-xs font-bold text-text">Tags</span>
        {selectedTags.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {selectedTags.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1.5 rounded-[6px] bg-brand-50 px-2.5 py-1 text-[0.68rem] font-bold text-brand-500">
                {t.label}
                <button
                  type="button"
                  onClick={() => toggle(form.tagIds, t.id, form.setTagIds)}
                  className="font-extrabold opacity-80 hover:opacity-100"
                  aria-label={`Remove ${t.label}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          type="text"
          value={tagSearch}
          onChange={(e) => setTagSearch(e.target.value)}
          placeholder="Search tags..."
          className="mb-2.5 h-9 w-full rounded-inner border border-border bg-surface px-2.5 text-[0.74rem] text-text outline-none focus:border-brand-500"
        />
        <div className="flex max-h-[210px] flex-col gap-0.5 overflow-y-auto rounded-inner border border-border p-1.5">
          {filteredTags.map((t) => (
            <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-[7px] px-1.5 py-1.5 text-[0.74rem] font-semibold text-text hover:bg-surface-2">
              <input type="checkbox" checked={form.tagIds.includes(t.id)} onChange={() => toggle(form.tagIds, t.id, form.setTagIds)} className="h-3.5 w-3.5 accent-brand-500" />
              {t.label}
            </label>
          ))}
          {filteredTags.length === 0 && <p className="px-1.5 py-2 text-[0.72rem] text-muted">No tags match your search.</p>}
        </div>
      </div>
    </div>
  );
}
