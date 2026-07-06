"use client";

export interface CircleBadgeBarItem {
  imageUrl?: string;
  label: string;
}

export interface CircleBadgeBarProps {
  items: CircleBadgeBarItem[];
}

export function CircleBadgeBar({ items }: CircleBadgeBarProps) {
  if (items.length === 0) return null;

  return (
    <div className="relative mt-10">
      <div className="h-[110px] rounded-2xl bg-beige" />
      <div className="absolute inset-x-0 -top-6 flex justify-around px-[5%]">
        {items.map((item, i) => (
          <div
            key={`${item.label}-${i}`}
            className="h-[66px] w-[66px] overflow-hidden rounded-full border-2 border-green bg-white"
            title={item.label}
          >
            {item.imageUrl && (
              <img
                src={item.imageUrl}
                alt={item.label}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
