"use client";

import { DefaultLink, type LinkComponent } from "../lib/link-component";

export interface PromoTileProps {
  imageUrl?: string;
  heading: string;
  blurb?: string;
  viewAllHref: string;
  viewAllLabel?: string;
  linkComponent?: LinkComponent;
}

export function PromoTile({
  imageUrl,
  heading,
  blurb,
  viewAllHref,
  viewAllLabel = "View All",
  linkComponent: Link = DefaultLink,
}: PromoTileProps) {
  return (
    // Source images are ideally 392×660 (portrait) — aspect-ratio keeps that
    // proportion at any column width. object-cover (not the blurred-fill
    // treatment used for Hero Banner/Banner Strip) is intentional here: this
    // is a background-style image with a text card anchored over it, so
    // filling the tile completely reads correctly even when cropped, unlike
    // a promotional graphic that needs to show in full.
    <div className="relative flex aspect-[392/660] flex-col justify-end overflow-hidden rounded-2xl bg-beige">
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div className="relative z-[1] m-4 rounded-xl bg-white/90 p-4 backdrop-blur-sm">
        <h3 className="font-serif text-xl font-semibold text-ink">{heading}</h3>
        {blurb && <p className="mt-1 font-body text-sm text-muted">{blurb}</p>}
        <Link href={viewAllHref} className="mt-2 inline-block font-ui text-sm font-semibold text-green hover:underline">
          {viewAllLabel}
        </Link>
      </div>
    </div>
  );
}
