"use client";

import { useRef, useState } from "react";
import { Button, Modal } from "@amader/admin-ui";
import { useUpdateMediaAltText, useUploadMedia } from "@/hooks/useMedia";
import { MediaLibraryBrowser } from "@/components/media/MediaLibraryBrowser";

export interface GalleryImage {
  id: number;
  url: string;
  alt?: string | null;
}

export interface ProductMediaGalleryProps {
  images: GalleryImage[];
  onChange: (images: GalleryImage[]) => void;
}

// Products reference media by id (`mediaIds: number[]`, first = primary),
// unlike every other module's single-image MediaPicker which only tracks a
// URL — so this is its own component, not a reuse of MediaPicker.
export function ProductMediaGallery({ images, onChange }: ProductMediaGalleryProps) {
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

  function saveAlt(id: number, alt: string) {
    updateAlt.mutate({ id, altText: alt });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {images.map((img, i) => (
          <div key={img.id} className="group relative w-48 overflow-hidden rounded-inner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt=""
              className={`h-48 w-48 rounded-inner border object-cover ${i === 0 ? "border-brand-500" : "border-border"}`}
            />
            {i === 0 && (
              <span className="absolute top-1 left-1 rounded-pill bg-brand-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                Primary
              </span>
            )}
            <button
              type="button"
              aria-label="Remove image"
              onClick={() => remove(img.id)}
              className="absolute top-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            {i !== 0 && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-6 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => moveToFront(img.id)}
                  className="pointer-events-auto inline-flex items-center gap-1 rounded-pill bg-white px-2.5 py-1 text-[11px] font-semibold text-text shadow-sm transition-colors hover:bg-brand-500 hover:text-white"
                >
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
                    <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 6.9L12 17.3 5.8 20.8l1.6-6.9L2 9.2l7.1-.6z" />
                  </svg>
                  Make primary
                </button>
              </div>
            )}
            <input
              value={img.alt ?? ""}
              onChange={(e) => setAlt(img.id, e.target.value)}
              onBlur={(e) => saveAlt(img.id, e.target.value)}
              placeholder="Alt text (for SEO)"
              className="mt-1.5 h-8 w-full rounded-sm border border-border bg-surface px-2 text-xs text-text outline-none focus:border-brand-500"
            />
          </div>
        ))}
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
      <div className="mt-2 flex gap-2">
        <Button type="button" variant="ghost" disabled={upload.isPending} onClick={() => fileInputRef.current?.click()}>
          {upload.isPending ? "Uploading…" : "Add images"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setShowLibrary(true)}>
          Browse library
        </Button>
      </div>
      <Modal open={showLibrary} onClose={() => setShowLibrary(false)} title="Browse media library" className="max-w-5xl">
        <MediaLibraryBrowser onSelect={toggleFromLibrary} isSelected={(media) => images.some((img) => img.id === media.id)} />
      </Modal>
    </div>
  );
}
