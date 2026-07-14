"use client";

import { useRef } from "react";
import { Button } from "@amader/admin-ui";
import { useUploadMedia } from "@/hooks/useMedia";

export interface GalleryImage {
  id: number;
  url: string;
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

  return (
    <div>
      <span className="mb-2 block text-xs font-semibold text-secondary">Images (first = primary)</span>
      <div className="flex flex-wrap gap-3">
        {images.map((img, i) => (
          <div key={img.id} className="relative w-24">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt=""
              className={`h-24 w-24 rounded-inner border object-cover ${i === 0 ? "border-brand-500" : "border-border"}`}
            />
            {i === 0 && (
              <span className="absolute top-1 left-1 rounded-pill bg-brand-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                Primary
              </span>
            )}
            <div className="mt-1 flex justify-center gap-2 text-[11px]">
              {i !== 0 && (
                <button type="button" className="text-brand-500" onClick={() => moveToFront(img.id)}>
                  Make primary
                </button>
              )}
              <button type="button" className="text-danger" onClick={() => remove(img.id)}>
                Remove
              </button>
            </div>
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
