"use client";

import { useRef, useState } from "react";
import { Button, Modal } from "@amader/admin-ui";
import { useMediaLibrary, useUploadMedia } from "@/hooks/useMedia";

export interface MediaPickerProps {
  value: string | undefined;
  onChange: (url: string) => void;
  label?: string;
}

// Real upload widget (per the design phase's confirmed scope): a file picker
// that POSTs to the existing admin/media endpoint and fills the resulting
// URL in, plus a "browse library" grid over already-uploaded media. Freshly
// uploaded images resolve fine; older migrated media stored as bare relative
// paths (pre-R2 rollout, a known separate backend gap) may not render a
// thumbnail here — not something this widget can fix.
export function MediaPicker({ value, onChange, label = "Image" }: MediaPickerProps) {
  const [showLibrary, setShowLibrary] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadMedia();
  const library = useMediaLibrary();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const media = await upload.mutateAsync(file);
    onChange(media.url);
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
      </div>
      <Modal open={showLibrary} onClose={() => setShowLibrary(false)} title="Browse media library">
        {library.isLoading && <p className="text-sm text-muted">Loading…</p>}
        {!library.isLoading && library.data?.length === 0 && (
          <p className="text-sm text-muted">No media uploaded yet — use "Upload image" to add one.</p>
        )}
        <div className="grid grid-cols-4 gap-3 max-sm:grid-cols-3">
          {library.data?.map((media) => (
            <button
              key={media.id}
              type="button"
              onClick={() => {
                onChange(media.url);
                setShowLibrary(false);
              }}
              className="overflow-hidden rounded-inner border border-border transition-colors hover:border-brand-500"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={media.url} alt={media.altText ?? ""} className="aspect-square w-full object-cover" />
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
