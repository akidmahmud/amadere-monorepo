"use client";

import { useRef } from "react";
import { MediaPicker } from "@/components/MediaPicker";
import { RichTextEditor } from "@/components/RichTextEditor";
import { useStorefrontUrl } from "@/hooks/useStorefrontUrl";
import { useCategories } from "@/hooks/useCategories";
import { PUBLISH_STATUSES, type PublishStatus } from "@/hooks/useBrands";

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";
const textareaClass = "rounded-sm border border-border bg-surface p-3 text-sm text-text outline-none focus:border-brand-500";

export const DESCRIPTION_MAX_WORDS = 450;

export function countWords(text: string): number {
  if (!text) return 0;
  const plainText = text
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
  if (!plainText) return 0;
  return plainText.split(/\s+/).filter(Boolean).length;
}

// Same ASCII-first slugify as BlogPostFormFields.tsx/ProductFormFields.tsx —
// duplicated per-form rather than shared, matching this codebase's existing
// convention for this small pure function.
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

export interface CategoryFormFieldsProps {
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
  parentId: number | undefined;
  setParentId: (v: number | undefined) => void;
  imageUrl: string | undefined;
  setImageUrl: (v: string) => void;
  iconUrl: string | undefined;
  setIconUrl: (v: string) => void;
  bannerImageUrl: string | undefined;
  setBannerImageUrl: (v: string) => void;
  status: PublishStatus;
  setStatus: (v: PublishStatus) => void;
  isFeatured: boolean;
  setIsFeatured: (v: boolean) => void;
  /** Excludes this category from the parent picker — a category can't be its own parent. */
  excludeId?: number;
}

export function CategoryFormFields(props: CategoryFormFieldsProps) {
  const { data: categories } = useCategories();
  const slugEdited = useRef(false);
  const storefrontUrl = useStorefrontUrl();
  const enWordCount = countWords(props.descriptionEn);
  const bnWordCount = countWords(props.descriptionBn);

  function handleNameEnChange(v: string) {
    props.setNameEn(v);
    if (!slugEdited.current) props.setSlug(slugify(v));
  }

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
              <input required value={props.nameEn} onChange={(e) => handleNameEnChange(e.target.value)} className={inputClass} placeholder="e.g. Organic Rice" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-text">
                Name (বাংলা)<span className="ml-0.5 text-danger">*</span>
              </span>
              <input required lang="bn" value={props.nameBn} onChange={(e) => props.setNameBn(e.target.value)} className={inputClass} placeholder="যেমন: অর্গানিক চাল" />
            </label>
          </div>

          <label className="mb-3.5 flex flex-col gap-1.5">
            <span className="text-xs font-bold text-text">
              Permalink<span className="ml-0.5 text-danger">*</span>
            </span>
            <div className="flex h-10 items-center overflow-hidden rounded-sm border border-border bg-surface focus-within:border-brand-500">
              <span className="select-none whitespace-nowrap pl-3 text-sm text-muted">{storefrontUrl}/categories/</span>
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
            <div className="flex flex-col gap-1.5">
              <span className="flex items-center justify-between text-xs font-bold text-text">
                Description (English)
                <span className={enWordCount > DESCRIPTION_MAX_WORDS ? "font-semibold text-danger" : "font-semibold text-muted"}>
                  {enWordCount}/{DESCRIPTION_MAX_WORDS} words
                </span>
              </span>
              <RichTextEditor value={props.descriptionEn} onChange={props.setDescriptionEn} compact />
              {enWordCount > DESCRIPTION_MAX_WORDS && (
                <span className="text-xs font-semibold text-danger">Trim this by {enWordCount - DESCRIPTION_MAX_WORDS} word(s) to save.</span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="flex items-center justify-between text-xs font-bold text-text">
                Description (বাংলা)
                <span className={bnWordCount > DESCRIPTION_MAX_WORDS ? "font-semibold text-danger" : "font-semibold text-muted"}>
                  {bnWordCount}/{DESCRIPTION_MAX_WORDS} words
                </span>
              </span>
              <RichTextEditor value={props.descriptionBn} onChange={props.setDescriptionBn} compact />
              {bnWordCount > DESCRIPTION_MAX_WORDS && (
                <span className="text-xs font-semibold text-danger">Trim this by {bnWordCount - DESCRIPTION_MAX_WORDS} word(s) to save.</span>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-card border border-border bg-surface p-[18px]">
          <h3 className="mb-3.5 text-[0.9rem] font-extrabold text-text">Images</h3>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <MediaPicker value={props.imageUrl} onChange={props.setImageUrl} label="Image" />
            <MediaPicker value={props.iconUrl} onChange={props.setIconUrl} label="Icon" />
            <MediaPicker value={props.bannerImageUrl} onChange={props.setBannerImageUrl} label="Banner (top of category page)" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-[18px]">
        <div className="rounded-card border border-border bg-surface p-[18px]">
          <h3 className="mb-3.5 text-[0.9rem] font-extrabold text-text">Organization</h3>

          <label className="mb-3.5 flex flex-col gap-1.5">
            <span className="text-xs font-bold text-text">Parent category</span>
            <select value={props.parentId ?? ""} onChange={(e) => props.setParentId(e.target.value ? Number(e.target.value) : undefined)} className={inputClass}>
              <option value="">None (top-level)</option>
              {categories
                ?.filter((c) => c.id !== props.excludeId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.translations[0]?.name ?? c.slug}
                  </option>
                ))}
            </select>
          </label>

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
            <span className="text-text">Featured on homepage</span>
            <label className="relative inline-flex h-[22px] w-10 flex-none cursor-pointer items-center">
              <input type="checkbox" checked={props.isFeatured} onChange={(e) => props.setIsFeatured(e.target.checked)} className="peer sr-only" />
              <span className="absolute inset-0 rounded-pill bg-[#dfe5ee] transition-colors peer-checked:bg-brand-500" />
              <span className="absolute left-[3px] h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-[18px]" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
