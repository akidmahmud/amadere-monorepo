"use client";

import { useRef } from "react";
import { Button, Card } from "@amader/admin-ui";
import { useDeleteMedia, useMediaLibrary, useUploadMedia } from "@/hooks/useMedia";

// Distinct from the MediaPicker widget embedded in other forms — this is a
// real library management view (browse everything, delete unused files),
// not a single-image picker.
export default function MediaLibraryPage() {
  const { data: media, isLoading } = useMediaLibrary();
  const upload = useUploadMedia();
  const deleteMedia = useDeleteMedia();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const file of files) {
      await upload.mutateAsync(file);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">{media?.length ?? 0} media items</p>
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
        <Button variant="primary" disabled={upload.isPending} onClick={() => fileInputRef.current?.click()}>
          {upload.isPending ? "Uploading…" : "Upload"}
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {media && media.length === 0 && <p className="text-sm text-muted">No media uploaded yet.</p>}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
        {media?.map((item) => (
          <Card key={item.id} className="flex flex-col gap-2 p-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.url} alt={item.altText ?? ""} className="aspect-square w-full rounded-inner border border-border object-cover" />
            <div className="truncate text-[11px] text-muted">
              {item.width && item.height ? `${item.width}×${item.height}` : item.type}
            </div>
            <Button
              type="button"
              variant="ghost"
              className="text-xs"
              disabled={deleteMedia.isPending}
              onClick={() => {
                if (confirm("Delete this media item? Fails if it's still attached to a product.")) {
                  deleteMedia.mutate(item.id, {
                    onError: (err) => alert((err as Error).message),
                  });
                }
              }}
            >
              Delete
            </Button>
          </Card>
        ))}
      </div>
    </>
  );
}
