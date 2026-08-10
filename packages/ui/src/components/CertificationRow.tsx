"use client";

export interface CertificationRowItem {
  imageUrl?: string;
  label?: string;
}

export interface CertificationRowProps {
  items?: CertificationRowItem[];
  count?: number;
}

function Badge({ item }: { item: CertificationRowItem }) {
  // `relative` + `absolute inset-0` on the img, not h-full/w-full on a grid
  // child: these logo images have their own square intrinsic aspect ratio,
  // and a percentage height on a grid item with no explicit stretch resolves
  // against that intrinsic ratio instead of this box's actual 119×100 rect —
  // rendering the badge as a square hanging out past the bottom of the white
  // rounded box. Absolute positioning resolves h-full/w-full against the
  // nearest positioned ancestor unambiguously, so object-contain can
  // correctly letterbox the square logo inside the rectangle.
  // Size/radius matched to organicindia.com's certification row (119×100
  // badge, 10px radius) per direct measurement of their live site.
  return (
    <div
      className="relative h-[100px] w-[119px] shrink-0 rounded-[10px] bg-white shadow-[0_2px_10px_rgba(0,0,0,.06)]"
      title={item.label}
    >
      {item.imageUrl && (
        <img src={item.imageUrl} alt={item.label ?? ""} className="absolute inset-0 h-full w-full object-contain p-1.5" />
      )}
    </div>
  );
}

// One badge (119px) + its gap (10px) — used only to estimate how many times
// the real list needs repeating below, not for layout itself.
const BADGE_PITCH_PX = 129;
// Comfortably wider than this site's widest section (max-w-1440 minus
// padding) so a single "copy" of the list always overflows the container.
const MIN_COPY_WIDTH_PX = 2000;

// The homepage-sections module ships this (type CERTIFICATION_ROW) — real
// badge images render here; plain boxes stay as the empty-state fallback.
// Always a continuous auto-scrolling strip (same treatment at every
// breakpoint, matching organicindia.com's certification row) — no arrows,
// no dots, nothing to click, it just drifts (pure CSS, no JS/library).
export function CertificationRow({ items, count = 7 }: CertificationRowProps) {
  const list: CertificationRowItem[] = items && items.length > 0 ? items : Array.from({ length: count }, () => ({}));

  // The 0%→-50% loop below only reads as badges entering from the right and
  // exiting past the left if a single copy of the list is already wider
  // than the section — with only a handful of real certifications, the
  // (undoubled) strip is narrower than its container and just drifts inside
  // it instead, which looked like it "starts from the center" rather than
  // sweeping in from the right. Repeating the real list until one copy
  // safely overflows the widest section first, then duplicating *that* once
  // for the seamless loop, fixes it regardless of how few are configured.
  const copies = Math.max(1, Math.ceil(MIN_COPY_WIDTH_PX / (list.length * BADGE_PITCH_PX)));
  const copy = Array.from({ length: copies }, () => list).flat();

  return (
    <div className="overflow-hidden">
      <div className="flex w-max animate-marquee gap-[10px]">
        {[...copy, ...copy].map((item, i) => (
          <Badge key={i} item={item} />
        ))}
      </div>
    </div>
  );
}
