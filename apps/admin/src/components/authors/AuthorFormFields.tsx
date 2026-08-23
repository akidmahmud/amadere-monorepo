"use client";

import { useRef } from "react";
import { AUTHOR_MAX_SOCIAL, AUTHOR_SOCIAL_ICONS } from "@amader/shared";
import type { AuthorSocialIcon } from "@amader/shared";
import { MediaPicker } from "@/components/MediaPicker";
import { RichTextEditor } from "@/components/RichTextEditor";
import { StatusSelect } from "@/components/StatusSelect";
import type { PublishStatus } from "@/hooks/useBrands";

export interface AuthorSocialLinkDraft {
  // The shared union, not a bare string — the create/update payload is typed
  // to the same icon set, so widening it here only defers the mismatch to
  // the call site.
  icon: AuthorSocialIcon;
  url: string;
}

// Blank-url rows are dropped rather than rejected — an admin who clicks
// "+ Add social link" and changes their mind should still be able to save.
// Lives here, next to the draft type, because both the create and the edit
// page have to apply the identical rule before POST/PATCH.
export function cleanSocialLinks(links: AuthorSocialLinkDraft[]) {
  return links.map((l) => ({ icon: l.icon, url: l.url.trim() })).filter((l) => l.url !== "");
}

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
  // A Bengali-only name strips to nothing above — fall back to a unicode
  // slug rather than handing the backend an empty string, the same two-pass
  // approach DigitalProductFormFields' own slugify uses.
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

const inputClass =
  "h-10 w-full rounded-xl border border-slate-200/80 bg-white px-3.5 text-sm font-semibold text-slate-900 outline-none transition-all duration-150 focus:border-[#059669] focus:ring-2 focus:ring-[#a7f3d0]/50 placeholder:text-slate-400";

const cardClass = "rounded-2xl border border-slate-200/60 bg-white p-6 shadow-xs";
const cardHeadingClass = "mb-5 flex items-center gap-2.5 text-base font-extrabold text-[#064e3b]";

export interface AuthorFormFieldsProps {
  nameEn: string;
  setNameEn: (v: string) => void;
  nameBn: string;
  setNameBn: (v: string) => void;
  bioEn: string;
  setBioEn: (v: string) => void;
  bioBn: string;
  setBioBn: (v: string) => void;
  slug: string;
  setSlug: (v: string) => void;
  photoUrl?: string;
  setPhotoUrl: (v?: string) => void;
  socialLinks: AuthorSocialLinkDraft[];
  setSocialLinks: (v: AuthorSocialLinkDraft[]) => void;
  status: PublishStatus;
  setStatus: (v: PublishStatus) => void;
  formError?: string | null;
}

/**
 * Author create/edit fields.
 *
 * Bilingual for real, unlike BrandFormFields (which writes one typed name to
 * both locales): an author's name and bio are the two strings the storefront
 * shows in the reader's own script, and "Humayun Ahmed" / "হুমায়ূন আহমেদ" are
 * genuinely different text. Everything else — photo, slug, social links — is
 * locale-invariant and lives on the Author row itself.
 */
export function AuthorFormFields({
  nameEn,
  setNameEn,
  nameBn,
  setNameBn,
  bioEn,
  setBioEn,
  bioBn,
  setBioBn,
  slug,
  setSlug,
  photoUrl,
  setPhotoUrl,
  socialLinks,
  setSocialLinks,
  status,
  setStatus,
  formError,
}: AuthorFormFieldsProps) {
  const slugEdited = useRef(false);

  function handleNameEnChange(v: string) {
    setNameEn(v);
    if (!slugEdited.current) setSlug(slugify(v));
  }

  function updateLink(index: number, patch: Partial<AuthorSocialLinkDraft>) {
    setSocialLinks(socialLinks.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <div className={cardClass}>
          <h3 className={cardHeadingClass}>
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#ecfdf5] text-[#059669]">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </span>
            <span>Author Information</span>
          </h3>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-slate-800">
                  Name (English)<span className="ml-0.5 text-rose-500">*</span>
                </span>
                <input required value={nameEn} onChange={(e) => handleNameEnChange(e.target.value)} placeholder="e.g. Humayun Ahmed" className={inputClass} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-slate-800">
                  Name (বাংলা)<span className="ml-0.5 text-rose-500">*</span>
                </span>
                <input required value={nameBn} onChange={(e) => setNameBn(e.target.value)} placeholder="যেমন হুমায়ূন আহমেদ" className={inputClass} />
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-800">
                Slug<span className="ml-0.5 text-rose-500">*</span>
              </span>
              <div className="flex h-10 items-center overflow-hidden rounded-xl border border-slate-200/80 bg-white focus-within:border-[#059669] focus-within:ring-2 focus-within:ring-[#a7f3d0]/50">
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
                  className="h-full min-w-0 flex-1 border-0 bg-transparent px-3.5 text-xs font-bold text-slate-900 outline-none"
                />
                <button
                  type="button"
                  title="Regenerate slug from the English name"
                  onClick={() => {
                    slugEdited.current = false;
                    setSlug(slugify(nameEn));
                  }}
                  className="grid h-full w-10 flex-none place-items-center text-slate-400 transition-colors hover:text-[#059669]"
                >
                  {wandIcon}
                </button>
              </div>
              {/* No storefront preview link here, unlike brands/categories —
                  authors have no public page of their own; they surface only
                  inside a book's Author tab. */}
              <span className="text-[11px] font-medium text-slate-500">Identifies the author internally. There is no public author page.</span>
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-800">Bio (English)</span>
              <RichTextEditor value={bioEn} onChange={setBioEn} compact />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-800">Bio (বাংলা)</span>
              <RichTextEditor value={bioBn} onChange={setBioBn} compact />
            </div>
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

        <div className={cardClass}>
          <h3 className={cardHeadingClass}>
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#ecfdf5] text-[#059669]">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
                <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
              </svg>
            </span>
            <span>Social Links</span>
          </h3>
          <p className="mb-4 text-[11px] font-medium text-slate-500">
            Rendered as icons on the book&apos;s Author tab. There is no follow button — these links are the only outbound action there.
          </p>

          <div className="flex flex-col gap-3">
            {socialLinks.map((link, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <select
                  value={link.icon}
                  // The options are rendered from AUTHOR_SOCIAL_ICONS, so the
                  // value is always one of them; the DOM just types it as string.
                  onChange={(e) =>
                    updateLink(index, { icon: e.target.value as AuthorSocialIcon })
                  }
                  className="h-10 w-[130px] shrink-0 rounded-xl border border-slate-200/80 bg-white px-2.5 text-xs font-bold text-slate-900 outline-none focus:border-[#059669]"
                >
                  {AUTHOR_SOCIAL_ICONS.map((icon) => (
                    <option key={icon} value={icon}>
                      {icon}
                    </option>
                  ))}
                </select>
                <input
                  type="url"
                  value={link.url}
                  onChange={(e) => updateLink(index, { url: e.target.value })}
                  placeholder="https://facebook.com/author"
                  className={`${inputClass} min-w-[200px] flex-1`}
                />
                <button
                  type="button"
                  aria-label="Remove social link"
                  onClick={() => setSocialLinks(socialLinks.filter((_, i) => i !== index))}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-rose-200 bg-rose-50 text-lg font-bold text-rose-700 transition-colors hover:bg-rose-600 hover:text-white"
                >
                  ×
                </button>
              </div>
            ))}
            {socialLinks.length === 0 && <p className="text-xs font-medium text-slate-400">No social links yet.</p>}
          </div>

          <button
            type="button"
            disabled={socialLinks.length >= AUTHOR_MAX_SOCIAL}
            onClick={() => setSocialLinks([...socialLinks, { icon: AUTHOR_SOCIAL_ICONS[0], url: "" }])}
            className="mt-4 inline-flex h-9 items-center rounded-xl border border-slate-200/80 bg-white px-3.5 text-xs font-bold text-slate-700 transition-colors hover:border-[#059669] hover:text-[#059669] disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Add social link
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:col-span-1">
        <div className={cardClass}>
          <h3 className="mb-4 flex items-center gap-2.5 text-base font-extrabold text-[#064e3b]">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#ecfdf5] text-[#059669]">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </span>
            <span>Author Photo</span>
          </h3>
          <MediaPicker value={photoUrl} onChange={setPhotoUrl} label="Photo" />
        </div>

        <div className={`${cardClass} flex flex-col gap-4`}>
          <h3 className="flex items-center gap-2.5 text-base font-extrabold text-[#064e3b]">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#ecfdf5] text-[#059669]">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </span>
            <span>Status</span>
          </h3>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-slate-800">Publish Status</span>
            <StatusSelect value={status} onChange={setStatus} />
          </div>
        </div>
      </div>
    </div>
  );
}
