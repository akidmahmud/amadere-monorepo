"use client";

import { useDeleteMedia } from "@/hooks/useMedia";
import { MediaLibraryBrowser } from "@/components/media/MediaLibraryBrowser";

export default function MediaLibraryPage() {
  const deleteMedia = useDeleteMedia();

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 max-w-[1600px] mx-auto w-full">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/70 pb-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-500/10 text-brand-600 font-bold text-lg shadow-inner">
            📁
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-tight text-text">Media Library</h1>
            <p className="text-xs font-medium text-muted">
              Organize assets, manage folders, and upload product media
            </p>
          </div>
        </div>
      </div>

      {/* Main Browser View */}
      <MediaLibraryBrowser
        renderItemActions={(item) => (
          <button
            type="button"
            disabled={deleteMedia.isPending}
            onClick={() => {
              if (confirm("Delete this media item? Fails if it's still attached to a product.")) {
                deleteMedia.mutate(item.id, {
                  onError: (err) => alert((err as Error).message),
                });
              }
            }}
            className="mt-1 w-full rounded-xl border border-danger/20 bg-danger/5 py-1 text-center text-xs font-bold text-danger hover:bg-danger hover:text-white transition-all disabled:opacity-50 active:scale-95"
          >
            Delete
          </button>
        )}
      />
    </div>
  );
}

