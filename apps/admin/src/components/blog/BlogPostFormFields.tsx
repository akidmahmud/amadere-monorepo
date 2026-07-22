"use client";

import { useRef } from "react";
import { useBlogCategories } from "@/hooks/useBlogCategories";
import { RichTextEditor } from "@/components/products/RichTextEditor";
import { BlogHtmlDropzone, type ParsedHtmlPost } from "./BlogHtmlDropzone";
import { CoverImageDropzone } from "./CoverImageDropzone";
import { BlogTagsPicker } from "./BlogTagsPicker";

const inputClass = "h-[38px] rounded-sm border border-border bg-surface px-3 text-sm font-semibold text-ink outline-none focus:border-brand-500";
const textareaClass = "rounded-sm border border-border bg-surface p-3 text-sm text-text outline-none focus:border-brand-500";

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export interface BlogPostFormFieldsProps {
  title: string;
  setTitle: (v: string) => void;
  slug: string;
  setSlug: (v: string) => void;
  excerpt: string;
  setExcerpt: (v: string) => void;
  content: string;
  setContent: (v: string) => void;
  metaDescription: string;
  setMetaDescription: (v: string) => void;
  imageUrl: string | undefined;
  setImageUrl: (v: string) => void;
  isFeatured: boolean;
  setIsFeatured: (v: boolean) => void;
  categoryIds: number[];
  setCategoryIds: (v: number[]) => void;
  tagIds: number[];
  setTagIds: (v: number[]) => void;
  /** Publish card's status pill — read-only display, real status changes happen via the workflow buttons above (edit page only). */
  statusLabel?: string;
  statusPillClass?: string;
}

export function BlogPostFormFields(props: BlogPostFormFieldsProps) {
  const { data: categories } = useBlogCategories();
  const slugEdited = useRef(false);

  function handleTitleChange(v: string) {
    props.setTitle(v);
    if (!slugEdited.current) props.setSlug(slugify(v));
  }

  function handleParsed(fields: ParsedHtmlPost) {
    if (fields.title) handleTitleChange(fields.title);
    if (fields.excerpt) props.setExcerpt(fields.excerpt);
    if (fields.metaDescription) props.setMetaDescription(fields.metaDescription);
    if (fields.content) props.setContent(fields.content);
  }

  function toggleCategory(id: number) {
    props.setCategoryIds(props.categoryIds.includes(id) ? props.categoryIds.filter((x) => x !== id) : [...props.categoryIds, id]);
  }

  return (
    <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-[18px]">
        <div className="rounded-card border border-border bg-surface p-[18px]">
          <h3 className="mb-3.5 text-[0.9rem] font-extrabold text-text">Post Content</h3>

          <label className="mb-3.5 flex flex-col gap-1.5">
            <span className="text-xs font-bold text-text">
              Title<span className="ml-0.5 text-danger">*</span>
            </span>
            <input required value={props.title} onChange={(e) => handleTitleChange(e.target.value)} className={inputClass} placeholder="e.g. Post title" />
          </label>

          <label className="mb-3.5 flex flex-col gap-1.5">
            <span className="text-xs font-bold text-text">
              Slug<span className="ml-0.5 text-danger">*</span>
            </span>
            <div className="flex items-center">
              <span className="flex h-[38px] flex-none items-center whitespace-nowrap rounded-l-[8px] border border-r-0 border-border bg-[#f7f9fc] px-2.5 text-[0.7rem] font-semibold text-muted">/blog/</span>
              <input
                required
                value={props.slug}
                onChange={(e) => {
                  slugEdited.current = true;
                  props.setSlug(e.target.value);
                }}
                className={`${inputClass} min-w-0 flex-1 rounded-l-none`}
                placeholder="auto-generated-from-title"
              />
            </div>
          </label>

          <label className="mb-3.5 flex flex-col gap-1.5">
            <span className="flex items-center justify-between text-xs font-bold text-text">
              Excerpt <span className="font-semibold text-muted">{props.excerpt.length}/200</span>
            </span>
            <textarea value={props.excerpt} onChange={(e) => props.setExcerpt(e.target.value)} rows={3} className={textareaClass} placeholder="A short summary shown on blog cards and previews..." />
          </label>

          <label className="mb-3.5 flex flex-col gap-1.5">
            <span className="text-xs font-bold text-text">
              Content<span className="ml-0.5 text-danger">*</span>
            </span>
            <RichTextEditor value={props.content} onChange={props.setContent} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="flex items-center justify-between text-xs font-bold text-text">
              Meta description <span className="font-semibold text-muted">{props.metaDescription.length}/160</span>
            </span>
            <textarea value={props.metaDescription} onChange={(e) => props.setMetaDescription(e.target.value)} rows={2} className={textareaClass} placeholder="Shown in search engine results. Leave empty to use the excerpt." />
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-[18px]">
        <div className="rounded-card border border-border bg-surface p-[18px]">
          <h3 className="mb-3.5 text-[0.9rem] font-extrabold text-text">Import from HTML</h3>
          <BlogHtmlDropzone onParsed={handleParsed} />
        </div>

        <div className="rounded-card border border-border bg-surface p-[18px]">
          <h3 className="mb-3.5 text-[0.9rem] font-extrabold text-text">Cover image</h3>
          <CoverImageDropzone value={props.imageUrl} onChange={props.setImageUrl} />
        </div>

        <div className="rounded-card border border-border bg-surface p-[18px]">
          <h3 className="mb-3.5 text-[0.9rem] font-extrabold text-text">Publish</h3>
          {props.statusLabel && (
            <div className="flex items-center justify-between border-b border-[#f1f5fa] py-2.5 text-[0.76rem] font-semibold">
              <span className="text-muted">Status</span>
              <span className={`inline-flex items-center rounded-[6px] px-2.5 py-1 text-[0.68rem] font-bold ${props.statusPillClass ?? "bg-surface-2 text-secondary"}`}>{props.statusLabel}</span>
            </div>
          )}
          <div className="flex items-center justify-between py-2.5 text-[0.76rem] font-semibold">
            <span className="text-muted">Featured</span>
            <label className="relative inline-flex h-[22px] w-10 flex-none cursor-pointer items-center">
              <input type="checkbox" checked={props.isFeatured} onChange={(e) => props.setIsFeatured(e.target.checked)} className="peer sr-only" />
              <span className="absolute inset-0 rounded-pill bg-[#dfe5ee] transition-colors peer-checked:bg-brand-500" />
              <span className="absolute left-[3px] h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-[18px]" />
            </label>
          </div>
        </div>

        <div className="rounded-card border border-border bg-surface p-[18px]">
          <h3 className="mb-3.5 text-[0.9rem] font-extrabold text-text">Categories</h3>
          <div className="flex max-h-[230px] flex-col gap-2 overflow-y-auto pr-1.5">
            {categories?.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 text-[0.76rem] font-semibold text-text">
                <input type="checkbox" checked={props.categoryIds.includes(c.id)} onChange={() => toggleCategory(c.id)} className="h-[15px] w-[15px] flex-none accent-brand-500" />
                {c.translations[0]?.name ?? c.slug}
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-card border border-border bg-surface p-[18px]">
          <h3 className="mb-3.5 text-[0.9rem] font-extrabold text-text">Tags</h3>
          <BlogTagsPicker tagIds={props.tagIds} onChange={props.setTagIds} />
        </div>
      </div>
    </div>
  );
}
