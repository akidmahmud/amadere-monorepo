"use client";

import { useRef, useState } from "react";
import { useStorefrontUrl } from "@/hooks/useStorefrontUrl";
import { usePickerProducts } from "@/hooks/usePickers";
import { PUBLISH_STATUSES, type PublishStatus } from "@/hooks/useBrands";

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";
const textareaClass = "rounded-sm border border-border bg-surface p-3 text-sm text-text outline-none focus:border-brand-500";

// Same ASCII-first slugify as CategoryFormFields.tsx/BlogPostFormFields.tsx —
// duplicated per-form, matching this codebase's existing convention.
function slugify(str: string): string {
  const ascii = str
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

export interface CollectionFormFieldsProps {
  nameEn: string;
  setNameEn: (v: string) => void;
  nameBn: string;
  setNameBn: (v: string) => void;
  slug: string;
  setSlug: (v: string) => void;
  descriptionEn: string;
  setDescriptionEn: (v: string) => void;
  descriptionBn: string;
  setDescriptionBn: (v: string) => void;
  status: PublishStatus;
  setStatus: (v: PublishStatus) => void;
  showInNav: boolean;
  setShowInNav: (v: boolean) => void;
  productIds: number[];
  setProductIds: (v: number[]) => void;
}

export function CollectionFormFields(props: CollectionFormFieldsProps) {
  const { data: products, isLoading: loadingProducts } = usePickerProducts();
  const slugEdited = useRef(false);
  const storefrontUrl = useStorefrontUrl();
  const [productQuery, setProductQuery] = useState("");

  function handleNameEnChange(v: string) {
    props.setNameEn(v);
    if (!slugEdited.current) props.setSlug(slugify(v));
  }

  function toggleProduct(id: number) {
    props.setProductIds(props.productIds.includes(id) ? props.productIds.filter((p) => p !== id) : [...props.productIds, id]);
  }

  const query = productQuery.trim().toLowerCase();
  const filteredProducts = query ? products?.filter((p) => p.label.toLowerCase().includes(query)) : products;

  return (
    <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-[18px]">
        <div className="rounded-card border border-border bg-surface p-[18px]">
          <h3 className="mb-3.5 text-[0.9rem] font-extrabold text-text">Basic Info</h3>

          <div className="mb-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-text">
                Name (English)<span className="ml-0.5 text-danger">*</span>
              </span>
              <input required value={props.nameEn} onChange={(e) => handleNameEnChange(e.target.value)} className={inputClass} placeholder="e.g. Summer Picks" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-text">
                Name (বাংলা)<span className="ml-0.5 text-danger">*</span>
              </span>
              <input required lang="bn" value={props.nameBn} onChange={(e) => props.setNameBn(e.target.value)} className={inputClass} placeholder="যেমন: গ্রীষ্মকালীন নির্বাচন" />
            </label>
          </div>

          <label className="mb-3.5 flex flex-col gap-1.5">
            <span className="text-xs font-bold text-text">
              Permalink<span className="ml-0.5 text-danger">*</span>
            </span>
            <div className="flex h-10 items-center overflow-hidden rounded-sm border border-border bg-surface focus-within:border-brand-500">
              <span className="select-none whitespace-nowrap pl-3 text-sm text-muted">{storefrontUrl}/collections/</span>
              <input
                required
                value={props.slug}
                onChange={(e) => {
                  slugEdited.current = true;
                  props.setSlug(e.target.value);
                }}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
                className="h-full min-w-0 flex-1 border-0 bg-transparent pr-2 text-sm font-semibold text-text outline-none"
              />
              <button
                type="button"
                title="Regenerate from English name"
                onClick={() => {
                  slugEdited.current = false;
                  props.setSlug(slugify(props.nameEn));
                }}
                className="grid h-full w-10 flex-none place-items-center text-muted transition-colors hover:text-brand-500"
              >
                {wandIcon}
              </button>
            </div>
          </label>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-text">Description (English)</span>
              <textarea value={props.descriptionEn} onChange={(e) => props.setDescriptionEn(e.target.value)} rows={4} className={textareaClass} placeholder="Optional — shown on the collection's storefront page" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-text">Description (বাংলা)</span>
              <textarea lang="bn" value={props.descriptionBn} onChange={(e) => props.setDescriptionBn(e.target.value)} rows={4} className={textareaClass} placeholder="ঐচ্ছিক — স্টোরফ্রন্টে দেখানো হবে" />
            </label>
          </div>
        </div>

        <div className="rounded-card border border-border bg-surface p-[18px]">
          <h3 className="mb-1 text-[0.9rem] font-extrabold text-text">Products</h3>
          <p className="mb-3.5 text-xs text-muted">Checked in the order you click them — that order is what shows on the storefront.</p>
          <input
            type="text"
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            placeholder="Search products…"
            className={`${inputClass} mb-3 w-full sm:w-72`}
          />
          {loadingProducts && <p className="text-sm text-muted">Loading…</p>}
          {props.productIds.length > 0 && (
            <p className="mb-2 text-xs font-semibold text-brand-500">{props.productIds.length} selected</p>
          )}
          <div className="flex max-h-[340px] flex-col gap-2 overflow-y-auto rounded-sm border border-border p-3">
            {filteredProducts?.length === 0 && <p className="text-sm text-muted">No products match "{productQuery}".</p>}
            {filteredProducts?.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-2 text-[0.8rem] font-semibold text-text">
                <input type="checkbox" checked={props.productIds.includes(p.id)} onChange={() => toggleProduct(p.id)} className="h-[15px] w-[15px] flex-none accent-brand-500" />
                <span className="min-w-0 flex-1 truncate">{p.label}</span>
                {props.productIds.includes(p.id) && <span className="flex-none text-xs text-muted">#{props.productIds.indexOf(p.id) + 1}</span>}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-[18px]">
        <div className="rounded-card border border-border bg-surface p-[18px]">
          <h3 className="mb-3.5 text-[0.9rem] font-extrabold text-text">Publish</h3>

          <label className="mb-3.5 flex flex-col gap-1.5">
            <span className="text-xs font-bold text-text">Status</span>
            <select value={props.status} onChange={(e) => props.setStatus(e.target.value as PublishStatus)} className={inputClass}>
              {PUBLISH_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center justify-between py-1 text-[0.76rem] font-semibold">
            <span className="text-text">Show in navbar</span>
            <label className="relative inline-flex h-[22px] w-10 flex-none cursor-pointer items-center">
              <input type="checkbox" checked={props.showInNav} onChange={(e) => props.setShowInNav(e.target.checked)} className="peer sr-only" />
              <span className="absolute inset-0 rounded-pill bg-[#dfe5ee] transition-colors peer-checked:bg-brand-500" />
              <span className="absolute left-[3px] h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-[18px]" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
