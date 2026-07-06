"use client";

import { DefaultLink, type LinkComponent } from "../lib/link-component";

export interface FeatureTileItem {
  imageUrl?: string;
  title?: string;
  linkUrl?: string;
}

export interface FeatureTileRowProps {
  tiles?: FeatureTileItem[];
  linkComponent?: LinkComponent;
  count?: number;
}

// The homepage-sections module now ships (type FEATURE_TILES) — real tiles
// render here; plain color tiles stay as the empty-state fallback.
export function FeatureTileRow({ tiles, linkComponent: Link = DefaultLink, count = 5 }: FeatureTileRowProps) {
  if (!tiles || tiles.length === 0) {
    return (
      <div className="flex gap-5 overflow-x-auto">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="h-[320px] w-[200px] shrink-0 rounded-brand bg-beige" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-5 overflow-x-auto">
      {tiles.map((tile, i) => {
        const content = (
          <div className="relative h-[320px] w-[200px] shrink-0 overflow-hidden rounded-brand bg-beige">
            {tile.imageUrl && (
              <img src={tile.imageUrl} alt={tile.title ?? ""} className="h-full w-full object-cover" />
            )}
            {tile.title && (
              <p className="absolute inset-x-0 bottom-0 bg-black/40 px-3 py-2 text-sm font-medium text-white">
                {tile.title}
              </p>
            )}
          </div>
        );
        return tile.linkUrl ? (
          <Link key={i} href={tile.linkUrl}>
            {content}
          </Link>
        ) : (
          <div key={i}>{content}</div>
        );
      })}
    </div>
  );
}
