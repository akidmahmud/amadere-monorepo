"use client";

import { useRef } from "react";
import { Button } from "@amader/admin-ui";
import { useUpdateMediaAltText, useUploadMedia } from "@/hooks/useMedia";

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
  const upload = useUploadMedia();
  const updateAlt = useUpdateMediaAltText();

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const uploaded = await Promise.all(files.map((f) => upload.mutateAsync(f)));
    onChange([...images, ...uploaded.map((m) => ({ id: m.id, url: m.url }))]);
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
          <div key={img.id} className="relative w-48">
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
              <button type="button" className="mt-1 block w-full text-center text-[11px] text-brand-500" onClick={() => moveToFront(img.id)}>
                Make primary
              </button>
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
      <Button
        type="button"
        variant="ghost"
        className="mt-2"
        disabled={upload.isPending}
        onClick={() => fileInputRef.current?.click()}
      >
        {upload.isPending ? "Uploading…" : "Add images"}
      </Button>
    </div>
  );
}
