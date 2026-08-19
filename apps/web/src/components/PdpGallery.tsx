"use client";

import { ProductGallery } from "@amader/ui";
import { useSelectedVariant } from "@/components/SelectedVariantProvider";

export interface PdpGalleryImage {
  url: string;
  /** Variant this image is pinned to (ProductMedia.variantId). Undefined/null
   * = shared image shown for every variant. */
  variantId?: number | null;
}

// Thin client wrapper over the shared ProductGallery: watches the selected
// variant and jumps the gallery to that variant's own image.
//
// Falls back silently when a variant has no image of its own — the gallery
// simply stays where it is, which lands on the primary image (index 0) on
// first load. That's the requested behaviour: "if a variant doesn't have an
// image it will show the primary one".
export function PdpGallery({ images, videoUrl }: { images: PdpGalleryImage[]; videoUrl?: string }) {
  const ctx = useSelectedVariant();
  const selected = ctx?.selectedVariantId;

  const matchIndex = selected
    ? images.findIndex((img) => img.variantId != null && String(img.variantId) === selected)
    : -1;

  return (
    <ProductGallery
      images={images.map((img) => ({ url: img.url }))}
      videoUrl={videoUrl}
      // undefined (not -1/0) when there's no variant-specific image, so the
      // gallery keeps whatever the shopper was looking at instead of being
      // yanked back to the first slide on every variant change.
      activeIndex={matchIndex >= 0 ? matchIndex : undefined}
    />
  );
}
