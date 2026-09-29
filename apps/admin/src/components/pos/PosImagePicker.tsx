"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Icon, Modal } from "@amader/admin-ui";
import { useToast } from "@/components/ToastProvider";
import { useUploadMedia } from "@/hooks/useMedia";
import { MediaLibraryBrowser } from "@/components/media/MediaLibraryBrowser";

export type PickedImage = { mediaId: number; url: string };

/**
 * Product photo for the POS: upload a new one or choose from the website's
 * media library. `onChange(null)` = remove.
 */
export function PosImagePicker({
  url,
  onChange,
  removeLabel = "Remove photo",
  hint,
}: {
  url: string | null | undefined;
  onChange: (img: PickedImage | null) => void;
  removeLabel?: string;
  hint?: string;
}) {
  const toast = useToast();
  const upload = useUploadMedia();
  const [library, setLibrary] = useState(false);
  const btn =
    "inline-flex cursor-pointer items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold hover:border-[#1d7a46] hover:bg-emerald-50";
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-contain" />
        ) : (
          <Icon name="image" size={28} className="text-gray-300" />
        )}
      </div>
      <div className="flex flex-col items-start gap-1.5">
        <div className="flex flex-wrap gap-1.5">
          <label className={btn}>
            <Icon name="upload" size={16} />
            {upload.isPending ? "Uploading…" : url ? "Upload new" : "Upload"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={upload.isPending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                upload.mutate(file, {
                  onSuccess: (m) =>
                    onChange({ mediaId: m.id, url: m.cardUrl ?? m.url }),
                  onError: (err) => toast.push(err.message),
                });
              }}
            />
          </label>
          <button
            type="button"
            className={btn}
            onClick={() => setLibrary(true)}
          >
            <Icon name="photo_library" size={16} /> Media library
          </button>
        </div>
        {url && (
          <button
            type="button"
            className="text-xs font-semibold text-gray-500 hover:text-red-600"
            onClick={() => onChange(null)}
          >
            {removeLabel}
          </button>
        )}
        {hint && <p className="text-[11px] text-gray-500">{hint}</p>}
      </div>
      {library &&
        createPortal(
          <div className="relative z-[70]">
            <Modal
              open
              onClose={() => setLibrary(false)}
              title="Choose a photo from the media library"
              className="h-[88vh] w-full max-w-6xl"
            >
              <MediaLibraryBrowser
                isModal
                onSelect={(m) => {
                  onChange({ mediaId: m.id, url: m.cardUrl ?? m.url });
                  setLibrary(false);
                }}
              />
            </Modal>
          </div>,
          document.body,
        )}
    </div>
  );
}
