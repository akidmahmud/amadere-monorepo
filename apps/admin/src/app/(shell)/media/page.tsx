"use client";

import { Button } from "@amader/admin-ui";
import { useDeleteMedia } from "@/hooks/useMedia";
import { MediaLibraryBrowser } from "@/components/media/MediaLibraryBrowser";

// Distinct from the MediaPicker widget embedded in other forms — this is a
// real library management view (browse everything, organize into folders,
// delete unused files), not a single-image picker. Shares MediaLibraryBrowser
// with MediaPicker's "Browse library" modal so both behave identically.
export default function MediaLibraryPage() {
  const deleteMedia = useDeleteMedia();

  return (
    <MediaLibraryBrowser
      renderItemActions={(item) => (
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
      )}
    />
  );
}
