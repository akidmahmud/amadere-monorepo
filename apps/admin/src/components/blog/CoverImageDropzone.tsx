"use client";

import { useRef, useState } from "react";
import { useUploadMedia } from "@/hooks/useMedia";

export function CoverImageDropzone({ value, onChange }: { value: string | undefined; onChange: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const upload = useUploadMedia();

  async function handleFile(file: File) {
    const media = await upload.mutateAsync(file);
    onChange(media.url);
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
        }}
        className={`relative flex h-[150px] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-[10px] border-[1.5px] border-dashed bg-[#fafcff] bg-cover bg-center transition-colors ${
          dragging ? "border-brand-500" : "border-[#c8d6ec] hover:border-brand-500"
        }`}
        style={value ? { backgroundImage: `url(${value})` } : undefined}
      >
        {!value && (
          <>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--muted)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <div className="text-[0.74rem] font-bold text-secondary">{upload.isPending ? "Uploading…" : "Click to upload cover image"}</div>
            <div className="text-[0.66rem] text-muted">JPG, PNG or WebP · 1200×630 recommended</div>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            if (e.target.files?.[0]) handleFile(e.target.files[0]);
          }}
        />
      </div>
      {value && (
        <button type="button" onClick={() => onChange("")} className="mt-2 text-[0.72rem] font-bold text-danger hover:underline">
          Remove cover image
        </button>
      )}
    </div>
  );
}
