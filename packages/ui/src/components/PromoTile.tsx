"use client";

export interface PromoTileProps {
  imageUrl?: string;
}

// Just the promo image, filling whatever box its parent gives it (h-full
// w-full) — no overlay text, button, or link, per explicit request.
export function PromoTile({ imageUrl }: PromoTileProps) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-beige">
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
      )}
    </div>
  );
}
