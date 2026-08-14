"use client";

import { useRef, useState } from "react";
import { Button, Modal } from "@amader/admin-ui";
import { useUploadMedia } from "@/hooks/useMedia";
import { MediaLibraryBrowser } from "@/components/media/MediaLibraryBrowser";
import type { components } from "@/lib/api/schema";

type MediaDto = components["schemas"]["MediaDto"];

export interface MediaPickerProps {
  value: string | undefined;
  onChange: (url: string) => void;
  /** Fires alongside onChange with the full record (id included) whenever a
   * new image is uploaded or picked from the library — existing callers
   * that only need the URL can ignore this. Added for settings that store a
   * media id rather than a bare URL, e.g. the site logo. */
  onSelectMedia?: (media: MediaDto) => void;
  label?: string;
}

// Real upload widget (per the design phase's confirmed scope): a file picker
// that POSTs to the existing admin/media endpoint and fills the resulting
// URL in, plus a "browse library" grid over already-uploaded media. Freshly
// uploaded images resolve fine; older migrated media stored as bare relative
// paths (pre-R2 rollout, a known separate backend gap) may not render a
// thumbnail here — not something this widget can fix.
export function MediaPicker({ value, onChange, onSelectMedia, label = "Image" }: MediaPickerProps) {
  const [showLibrary, setShowLibrary] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadMedia();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const media = await upload.mutateAsync(file);
    // ~1200w-capped WebP derivative, not the raw upload — every one of this
    // widget's callers (hero banners, testimonials, category showcases,
    // site logo, ...) displays at well under 1200w, so this is a strict
    // size win everywhere with no visible quality loss. Falls back to the
    // original for anything the derivative pipeline couldn't process (SVG).
    onChange(media.fullUrl ?? media.url);
    onSelectMedia?.(media);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-secondary">{label}</span>
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="h-24 w-24 rounded-inner border border-border object-cover" />
      )}
      <div className="flex gap-2">
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <Button type="button" variant="ghost" disabled={upload.isPending} onClick={() => fileInputRef.current?.click()}>
          {upload.isPending ? "Uploading…" : "Upload image"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setShowLibrary((v) => !v)}>
          Browse library
        </Button>
        {value && (
          <Button type="button" variant="ghost" style={{ color: "var(--danger)" }} onClick={() => onChange("")}>
            Remove
          </Button>
        )}
      </div>
      <Modal open={showLibrary} onClose={() => setShowLibrary(false)} title="Browse media library" className="max-w-5xl">
        <MediaLibraryBrowser
          onSelect={(media) => {
            onChange(media.fullUrl ?? media.url);
            onSelectMedia?.(media);
            setShowLibrary(false);
          }}
        />
      </Modal>
    </div>
  );
}
