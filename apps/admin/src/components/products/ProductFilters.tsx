"use client";

import { useCategories } from "@/hooks/useCategories";
import { useBrands } from "@/hooks/useBrands";
import type { AdminProductFilters } from "@/hooks/useProducts";

const selectClass =
  "h-9 w-full appearance-none rounded-inner border border-border bg-surface px-2.5 text-[0.75rem] font-semibold text-secondary outline-none focus:border-brand-500";
const inputClass = "h-9 min-w-0 flex-1 rounded-inner border border-border bg-surface px-2.5 text-[0.75rem] text-text outline-none focus:border-brand-500";

const STATUS_OPTIONS = [
  { value: "PUBLISHED", label: "Active" },
  { value: "DRAFT", label: "Draft" },
  { value: "ARCHIVED", label: "Archived" },
] as const;

const STOCK_OPTIONS = [
  { value: "IN_STOCK", label: "In Stock" },
  { value: "OUT_OF_STOCK", label: "Out of Stock" },
  { value: "ON_BACKORDER", label: "On Backorder" },
] as const;

export function ProductFilters({
  filters,
  onChange,
  onReset,
}: {
  filters: AdminProductFilters;
  onChange: (next: AdminProductFilters) => void;
  onReset: () => void;
}) {
  const { data: categories } = useCategories();
  const { data: brands } = useBrands();

  function set<K extends keyof AdminProductFilters>(key: K, value: AdminProductFilters[K]) {
    onChange({ ...filters, [key]: value, page: 1 });
  }

  function toggleCategory(id: number) {
    const current = filters.categoryIds ?? [];
    set("categoryIds", current.includes(id) ? current.filter((c) => c !== id) : [...current, id]);
  }

  return (
    <div className="rounded-card border border-border bg-surface p-[18px] shadow-card">
      <div className="mb-3.5 flex items-center justify-between">
        <h3 className="text-[0.95rem] font-extrabold text-text">Filters</h3>
        <button type="button" onClick={onReset} className="text-[0.76rem] font-bold text-brand-500 hover:underline">
          Reset
        </button>
      </div>

      <div className="mb-[18px]">
        <div className="mb-2.5 text-[0.76rem] font-bold text-text">Category</div>
        <div className="flex flex-col gap-2">
          {categories?.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-2 text-[0.76rem] font-semibold text-text">
              <input
                type="checkbox"
                checked={(filters.categoryIds ?? []).includes(c.id)}
                onChange={() => toggleCategory(c.id)}
                className="h-[15px] w-[15px] accent-brand-500"
              />
              {c.translations[0]?.name ?? c.slug}
              {c.productCount !== undefined && <span className="text-muted">({c.productCount})</span>}
            </label>
          ))}
        </div>
      </div>

      <div className="mb-[18px]">
        <div className="mb-2.5 text-[0.76rem] font-bold text-text">Status</div>
        <div className="flex flex-col gap-2">
          {STATUS_OPTIONS.map((s) => (
            <label key={s.value} className="flex cursor-pointer items-center gap-2 text-[0.76rem] font-semibold text-text">
              <input
                type="radio"
                name="status"
                checked={filters.status === s.value}
                onChange={() => set("status", s.value)}
                className="h-[15px] w-[15px] accent-brand-500"
              />
              {s.label}
            </label>
          ))}
          <label className="flex cursor-pointer items-center gap-2 text-[0.76rem] font-semibold text-text">
            <input type="radio" name="status" checked={!filters.status} onChange={() => set("status", undefined)} className="h-[15px] w-[15px] accent-brand-500" />
            All Status
          </label>
        </div>
      </div>

      <div className="mb-[18px]">
        <div className="mb-2.5 text-[0.76rem] font-bold text-text">Stock Status</div>
        <div className="flex flex-col gap-2">
          {STOCK_OPTIONS.map((s) => (
            <label key={s.value} className="flex cursor-pointer items-center gap-2 text-[0.76rem] font-semibold text-text">
              <input
                type="checkbox"
                checked={filters.stockStatus === s.value}
                onChange={() => set("stockStatus", filters.stockStatus === s.value ? undefined : s.value)}
                className="h-[15px] w-[15px] accent-brand-500"
              />
              {s.label}
            </label>
          ))}
        </div>
      </div>

      <div className="mb-[18px]">
        <div className="mb-2.5 text-[0.76rem] font-bold text-text">Price Range</div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Min Price"
            value={filters.minPrice ?? ""}
            onChange={(e) => set("minPrice", e.target.value ? Number(e.target.value) : undefined)}
            className={inputClass}
          />
          <span className="text-[0.74rem] font-semibold text-muted">to</span>
          <input
            type="number"
            placeholder="Max Price"
            value={filters.maxPrice ?? ""}
            onChange={(e) => set("maxPrice", e.target.value ? Number(e.target.value) : undefined)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="mb-[18px]">
        <div className="mb-2.5 text-[0.76rem] font-bold text-text">Created Date</div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={filters.createdFrom ?? ""}
            onChange={(e) => set("createdFrom", e.target.value || undefined)}
            className={inputClass}
          />
          <span className="text-[0.74rem] font-semibold text-muted">to</span>
          <input
            type="date"
            value={filters.createdTo ?? ""}
            onChange={(e) => set("createdTo", e.target.value || undefined)}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <div className="mb-2.5 text-[0.76rem] font-bold text-text">Brand</div>
        <select
          className={selectClass}
          value={filters.brandId ?? ""}
          onChange={(e) => set("brandId", e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">Select Brand</option>
          {brands?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.translations[0]?.name ?? b.slug}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
