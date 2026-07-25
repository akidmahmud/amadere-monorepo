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
  // against that intrinsic ratio instead of this box's actual 74×52 rect —
  // rendering the badge as a 74×74 square hanging out past the bottom of the
  // white rounded box. Absolute positioning resolves h-full/w-full against
  // the nearest positioned ancestor unambiguously, so object-contain can
  // correctly letterbox the square logo inside the rectangle.
  return (
    <div
      className="relative h-[52px] w-[74px] shrink-0 rounded-[10px] bg-white shadow-[0_2px_10px_rgba(0,0,0,.06)]"
      title={item.label}
    >
      {item.imageUrl && (
        <img src={item.imageUrl} alt={item.label ?? ""} className="absolute inset-0 h-full w-full object-contain p-1.5" />
      )}
    </div>
  );
}

// The homepage-sections module ships this (type CERTIFICATION_ROW) — real
// badge images render here; plain boxes stay as the empty-state fallback.
// Desktop: a centered, wrapped row (badges are few enough to fit). Mobile:
// a continuous auto-scrolling strip instead of wrapping to several short
// rows — no arrows, nothing to tap, it just drifts (the list is duplicated
// once so the CSS loop is seamless).
export function CertificationRow({ items, count = 7 }: CertificationRowProps) {
  const list: CertificationRowItem[] = items && items.length > 0 ? items : Array.from({ length: count }, () => ({}));

  return (
    <>
      <div className="hidden flex-wrap justify-center gap-6 sm:flex">
        {list.map((item, i) => (
          <Badge key={i} item={item} />
        ))}
      </div>
      <div className="overflow-hidden sm:hidden">
        <div className="flex w-max animate-marquee gap-6">
          {[...list, ...list].map((item, i) => (
            <Badge key={i} item={item} />
          ))}
        </div>
      </div>
    </>
  );
}
