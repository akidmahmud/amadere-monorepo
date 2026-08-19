"use client";

import { useRef, useState } from "react";
import { Button, Modal } from "@amader/admin-ui";
import { useUpdateMediaAltText, useUploadMedia } from "@/hooks/useMedia";
import { MediaLibraryBrowser } from "@/components/media/MediaLibraryBrowser";

export interface GalleryImage {
  id: number;
  url: string;
  alt?: string | null;
  /** Variant this image is pinned to. null/undefined = shared image, shown
   * for every variant on the storefront. */
  variantId?: number | null;
}

/** Minimal shape of a saved variant — enough to label the picker. */
export interface GalleryVariantOption {
  id: number;
  label: string;
}

export interface ProductMediaGalleryProps {
  images: GalleryImage[];
  onChange: (images: GalleryImage[]) => void;
  /** Saved variants available to pin an image to. Empty (the default) hides
   * the picker entirely — a simple product has nothing to assign to, and a
   * brand-new product's variants have no ids until it's saved once. */
  variants?: GalleryVariantOption[];
}

// Products reference media by id (`mediaIds: number[]`, first = primary),
// unlike every other module's single-image MediaPicker which only tracks a
// URL — so this is its own component, not a reuse of MediaPicker.
export function ProductMediaGallery({ images, onChange, variants = [] }: ProductMediaGalleryProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const upload = useUploadMedia();
  const updateAlt = useUpdateMediaAltText();

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const uploaded = await Promise.all(files.map((f) => upload.mutateAsync(f)));
    onChange([...images, ...uploaded.map((m) => ({ id: m.id, url: m.url }))]);
  }

  // Toggle, not add-only — clicking an already-added item in the library
  // browser removes it again. This is what actually fixes "no way to
  // unselect": the old grid disabled the button once added, so the only way
  // off was to close the modal and use the gallery's own × button.
  function toggleFromLibrary(media: { id: number; url: string; altText?: string | null }) {
    if (images.some((img) => img.id === media.id)) {
      remove(media.id);
    } else {
      onChange([...images, { id: media.id, url: media.url, alt: media.altText }]);
    }
  }

  function remove(id: number) {
    onChange(images.filter((img) => img.id !== id));
  }

  function moveToFront(id: number) {
    const img = images.find((i) => i.id === id);
    if (!img) return;
    onChange([img, ...images.filter((i) => i.id !== id)]);
  }

  function setAlt(id: number, alt: string) {
    onChange(images.map((img) => (img.id === id ? { ...img, alt } : img)));
  }

  // Local form state only — persisted with the rest of the product on Save
  // (unlike alt text, which has its own media endpoint and saves on blur).
  function setVariant(id: number, variantId: number | null) {
    onChange(images.map((img) => (img.id === id ? { ...img, variantId } : img)));
  }

  function saveAlt(id: number, alt: string) {
    updateAlt.mutate({ id, altText: alt });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3.5">
        {images.map((img, i) => (
          <div key={img.id} className="group relative w-48 overflow-hidden rounded-xl border border-emerald-800/20 bg-white p-1.5 shadow-sm transition-all duration-200 hover:border-amber-400/50 hover:shadow-md">
            <div className="relative overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt=""
                className={`h-44 w-full rounded-lg object-cover transition-transform duration-200 group-hover:scale-105 ${
                  i === 0 ? "border-2 border-amber-400 shadow-sm" : "border border-emerald-800/10"
                }`}
              />
              {i === 0 && (
                <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-950 shadow-md ring-1 ring-white/50">
                  <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" className="text-emerald-950">
                    <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 6.9L12 17.3 5.8 20.8l1.6-6.9L2 9.2l7.1-.6z" />
                  </svg>
                  Primary
                </span>
              )}
              <button
                type="button"
                aria-label="Remove image"
                onClick={() => remove(img.id)}
                className="absolute top-2 right-2 grid h-6 w-6 place-items-center rounded-full bg-emerald-950/70 text-white shadow-md backdrop-blur-sm transition-colors hover:bg-rose-600"
              >
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
              {i !== 0 && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-emerald-950/80 via-emerald-950/40 to-transparent px-2 pb-2 pt-6 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => moveToFront(img.id)}
                    className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-800 to-emerald-900 px-3 py-1 text-[11px] font-bold text-amber-300 shadow-md ring-1 ring-amber-400/40 transition-all hover:scale-105 hover:from-emerald-700 hover:to-emerald-800"
                  >
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" className="text-amber-400">
                      <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 6.9L12 17.3 5.8 20.8l1.6-6.9L2 9.2l7.1-.6z" />
                    </svg>
                    Make primary
                  </button>
                </div>
              )}
            </div>
            <input
              value={img.alt ?? ""}
              onChange={(e) => setAlt(img.id, e.target.value)}
              onBlur={(e) => saveAlt(img.id, e.target.value)}
              placeholder="Alt text (for SEO)"
              className="mt-2 h-8 w-full rounded-lg border border-emerald-800/15 bg-emerald-50/20 px-2.5 text-xs font-medium text-emerald-950 placeholder:text-emerald-900/40 outline-none transition-all focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-amber-400/30"
            />
            {/* Pin this image to a variant — the storefront gallery jumps to
                it when that variant is picked. Only rendered when the
                product actually has saved variants. */}
            {variants.length > 0 && (
              <select
                value={img.variantId != null ? String(img.variantId) : ""}
                onChange={(e) => setVariant(img.id, e.target.value ? Number(e.target.value) : null)}
                className="mt-1.5 h-8 w-full rounded-lg border border-emerald-800/15 bg-emerald-50/20 px-2 text-xs font-medium text-emerald-950 outline-none transition-all focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-amber-400/30"
              >
                <option value="">All variants (shared)</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={upload.isPending}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#a7f3d0] bg-white px-4 py-2 text-xs font-bold text-[#044e37] shadow-2xs transition-all duration-150 hover:bg-[#ecfdf5] disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-[#044e37]">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {upload.isPending ? "Uploading…" : "Add Images"}
        </button>
        <button
          type="button"
          onClick={() => setShowLibrary(true)}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#a7f3d0] bg-white px-4 py-2 text-xs font-bold text-[#044e37] shadow-2xs transition-all duration-150 hover:bg-[#ecfdf5]"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="text-[#044e37]">
            <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
          Browse Library
        </button>
      </div>
      <Modal open={showLibrary} onClose={() => setShowLibrary(false)} title="Browse media library" className="max-w-5xl">
        <MediaLibraryBrowser onSelect={toggleFromLibrary} isSelected={(media) => images.some((img) => img.id === media.id)} />
      </Modal>
    </div>
  );
}
