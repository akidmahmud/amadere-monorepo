"use client";

import { useRef } from "react";
import { MediaPicker } from "@/components/MediaPicker";
import { RichTextEditor } from "@/components/RichTextEditor";
import { StatusSelect } from "@/components/StatusSelect";
import { useStorefrontUrl } from "@/hooks/useStorefrontUrl";
import type { PublishStatus } from "@/hooks/useBrands";

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
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

const inputClass =
  "h-10 w-full rounded-xl border border-slate-200/80 bg-white px-3.5 text-sm font-semibold text-slate-900 outline-none transition-all duration-150 focus:border-[#059669] focus:ring-2 focus:ring-[#a7f3d0]/50 placeholder:text-slate-400";

export interface BrandFormFieldsProps {
  name: string;
  setName: (v: string) => void;
  slug: string;
  setSlug: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  logoUrl?: string;
  setLogoUrl: (v?: string) => void;
  websiteUrl: string;
  setWebsiteUrl: (v: string) => void;
  status: PublishStatus;
  setStatus: (v: PublishStatus) => void;
  isFeatured: boolean;
  setIsFeatured: (v: boolean) => void;
  formError?: string | null;
}

export function BrandFormFields({
  name,
  setName,
  slug,
  setSlug,
  description,
  setDescription,
  logoUrl,
  setLogoUrl,
  websiteUrl,
  setWebsiteUrl,
  status,
  setStatus,
  isFeatured,
  setIsFeatured,
  formError,
}: BrandFormFieldsProps) {
  const slugEdited = useRef(false);
  const storefrontUrl = useStorefrontUrl();

  function handleNameChange(v: string) {
    setName(v);
    if (!slugEdited.current) setSlug(slugify(v));
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-xs">
          <h3 className="mb-5 flex items-center gap-2.5 text-base font-extrabold text-[#064e3b]">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#ecfdf5] text-[#059669]">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
                <path d="M7 7h.01" />
              </svg>
            </span>
            <span>Brand Information</span>
          </h3>

          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-800">
                Brand Name<span className="ml-0.5 text-rose-500">*</span>
              </span>
              <input
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Nike, Amader Foods"
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-800">
                Permalink / Slug<span className="ml-0.5 text-rose-500">*</span>
              </span>
              <div className="flex h-10 items-center overflow-hidden rounded-xl border border-slate-200/80 bg-white focus-within:border-[#059669] focus-within:ring-2 focus-within:ring-[#a7f3d0]/50">
                <span className="select-none whitespace-nowrap pl-3.5 text-xs font-medium text-slate-400">{storefrontUrl}/brands/</span>
                <input
                  required
                  value={slug}
                  onChange={(e) => {
                    slugEdited.current = true;
                    setSlug(e.target.value);
                  }}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  className="h-full min-w-0 flex-1 border-0 bg-transparent pr-2 text-xs font-bold text-slate-900 outline-none"
                />
                <button
                  type="button"
                  title="Regenerate slug from name"
                  onClick={() => {
                    slugEdited.current = false;
                    setSlug(slugify(name));
                  }}
                  className="grid h-full w-10 flex-none place-items-center text-slate-400 transition-colors hover:text-[#059669]"
                >
                  {wandIcon}
                </button>
              </div>
              {slug && (
                <span className="text-[11px] font-medium text-slate-500">
                  Preview:{" "}
                  <a href={`${storefrontUrl}/brands/${slug}`} target="_blank" rel="noreferrer" className="text-[#059669] hover:underline font-semibold">
                    {storefrontUrl}/brands/{slug}
                  </a>
                </span>
              )}
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-800">Description (optional)</span>
              <RichTextEditor value={description} onChange={setDescription} compact />
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-800">Website URL (optional)</span>
              <div className="flex h-10 items-center overflow-hidden rounded-xl border border-slate-200/80 bg-white focus-within:border-[#059669] focus-within:ring-2 focus-within:ring-[#a7f3d0]/50">
                <span className="grid h-full w-10 place-items-center text-slate-400">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                </span>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://brandwebsite.com"
                  className="h-full min-w-0 flex-1 border-0 bg-transparent pr-3 text-xs font-bold text-slate-900 outline-none placeholder:text-slate-400 placeholder:font-normal"
                />
              </div>
            </label>
          </div>

          {formError && (
            <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{formError}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:col-span-1">
        <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-xs">
          <h3 className="mb-4 flex items-center gap-2.5 text-base font-extrabold text-[#064e3b]">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#ecfdf5] text-[#059669]">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </span>
            <span>Brand Logo</span>
          </h3>
          <MediaPicker value={logoUrl} onChange={setLogoUrl} label="Logo" />
        </div>

        <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-xs flex flex-col gap-4">
          <h3 className="flex items-center gap-2.5 text-base font-extrabold text-[#064e3b]">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#ecfdf5] text-[#059669]">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </span>
            <span>Status & Visibility</span>
          </h3>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-slate-800">Publish Status</span>
            <StatusSelect value={status} onChange={setStatus} />
          </div>

          <label
            className={`flex items-center justify-between rounded-xl border p-3.5 transition-all cursor-pointer select-none ${
              isFeatured ? "border-[#a7f3d0] bg-[#ecfdf5] shadow-2xs" : "border-slate-200/80 bg-slate-50/50 hover:bg-slate-100/60"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className={`grid h-8 w-8 place-items-center rounded-lg ${isFeatured ? "bg-amber-400/20 text-amber-600" : "bg-slate-200/60 text-slate-500"}`}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 6.9L12 17.3 5.8 20.8l1.6-6.9L2 9.2l7.1-.6z" />
                </svg>
              </span>
              <div className="flex flex-col">
                <span className="text-xs font-extrabold text-slate-900">Featured Brand</span>
                <span className="text-[11px] font-medium text-slate-500">Show in featured brand highlights</span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="h-4 w-4 rounded accent-[#059669] cursor-pointer"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
