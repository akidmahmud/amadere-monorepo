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
  /** Fires alongside onChange with the full record whenever a new image is uploaded or picked */
  onSelectMedia?: (media: MediaDto) => void;
  label?: string;
}

export function MediaPicker({ value, onChange, onSelectMedia, label = "Image" }: MediaPickerProps) {
  const [showLibrary, setShowLibrary] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadMedia();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const media = await upload.mutateAsync(file);
    onChange(media.fullUrl ?? media.url);
    onSelectMedia?.(media);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-bold uppercase tracking-wider text-muted">{label}</span>
      
      {value ? (
        <div className="group relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-2xl border border-border/80 bg-surface-2 p-1.5 shadow-sm transition-all hover:border-brand-500/60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-full w-full rounded-xl object-cover" />
          <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/60 opacity-0 backdrop-blur-xs transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={() => setShowLibrary(true)}
              className="rounded-lg bg-white/20 px-2 py-1 text-[11px] font-bold text-white hover:bg-white/30 backdrop-blur-sm transition-all"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              className="rounded-lg bg-danger/80 px-2 py-1 text-[11px] font-bold text-white hover:bg-danger backdrop-blur-sm transition-all"
            >
              Remove
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <Button
          type="button"
          variant="ghost"
          disabled={upload.isPending}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-xl border border-border/80 text-xs font-bold hover:border-brand-500/50 hover:bg-surface-2 transition-all"
        >
          {upload.isPending ? "Uploading…" : "↑ Upload image"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setShowLibrary((v) => !v)}
          className="rounded-xl border border-border/80 text-xs font-bold hover:border-brand-500/50 hover:bg-surface-2 transition-all"
        >
          🖼 Browse library
        </Button>
        {value && !showLibrary && (
          <Button
            type="button"
            variant="ghost"
            style={{ color: "var(--danger)" }}
            onClick={() => onChange("")}
            className="rounded-xl border border-danger/20 text-xs font-bold hover:bg-danger/10 transition-all"
          >
            Remove
          </Button>
        )}
      </div>

      <Modal
        open={showLibrary}
        onClose={() => setShowLibrary(false)}
        title={
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 font-bold text-sm">
              🖼
            </span>
            <div>
              <h2 className="text-base font-bold text-text">Browse Media Library</h2>
              <p className="text-[11px] font-normal text-muted">Select an image to attach or upload new files</p>
            </div>
          </div>
        }
        className="max-w-6xl w-full h-[88vh]"
      >
        <MediaLibraryBrowser
          isModal={true}
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

