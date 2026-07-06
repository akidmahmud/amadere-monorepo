"use client";

export interface CertificationRowItem {
  imageUrl?: string;
  label?: string;
}

export interface CertificationRowProps {
  items?: CertificationRowItem[];
  count?: number;
}

// The homepage-sections module now ships (type CERTIFICATION_ROW) — real
// badge icons render here; plain boxes stay as the empty-state fallback.
export function CertificationRow({ items, count = 7 }: CertificationRowProps) {
  if (!items || items.length === 0) {
    return (
      <div className="flex flex-wrap justify-center gap-6">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="h-[52px] w-[74px] rounded-[10px] bg-white shadow-[0_2px_10px_rgba(0,0,0,.06)]"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-center gap-6">
      {items.map((item, i) => (
        <div
          key={i}
          className="grid h-[52px] w-[74px] place-items-center rounded-[10px] bg-white shadow-[0_2px_10px_rgba(0,0,0,.06)]"
          title={item.label}
        >
          {item.imageUrl && (
            <img src={item.imageUrl} alt={item.label ?? ""} className="h-full w-full object-contain p-1.5" />
          )}
        </div>
      ))}
    </div>
  );
}
