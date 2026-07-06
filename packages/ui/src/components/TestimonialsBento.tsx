"use client";

const playIcon = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-[22px] w-[22px]">
    <path d="M8 5v14l11-7z" />
  </svg>
);
const chevronLeft = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className="h-[18px] w-[18px]">
    <path d="m15 18-6-6 6-6" />
  </svg>
);
const chevronRight = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className="h-[18px] w-[18px]">
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export interface TestimonialsBentoProps {
  mainImageUrl?: string;
  mainVideoUrl?: string;
  photos?: string[];
  dotCount?: number;
  activeDot?: number;
}

// The homepage-sections module now ships (type TESTIMONIAL_BENTO) — real
// photos/video render here; plain gray tiles stay as the empty-state
// fallback.
export function TestimonialsBento({
  mainImageUrl,
  mainVideoUrl,
  photos,
  dotCount = 8,
  activeDot = 0,
}: TestimonialsBentoProps) {
  const gridPhotos = photos ?? [];

  return (
    <div className="grid grid-cols-[180px_1fr_20px] gap-4">
      <div className="relative grid min-h-[380px] place-items-center overflow-hidden rounded-brand bg-gray">
        {mainImageUrl && (
          <img src={mainImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <button
          type="button"
          aria-label="Previous testimonial"
          className="absolute left-2.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-[9px] bg-gold text-white shadow-brand"
        >
          {chevronLeft}
        </button>
        {mainVideoUrl && (
          <a
            href={mainVideoUrl}
            target="_blank"
            rel="noreferrer"
            className="relative grid h-14 w-14 place-items-center rounded-full bg-green text-white shadow-[0_6px_18px_rgba(0,0,0,.25)]"
          >
            {playIcon}
          </a>
        )}
        <button
          type="button"
          aria-label="Next testimonial"
          className="absolute right-2.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-[9px] bg-gold text-white shadow-brand"
        >
          {chevronRight}
        </button>
      </div>

      <div className="grid grid-cols-2 auto-rows-[110px] gap-4">
        {[
          "col-start-1 row-start-1",
          "col-start-2 row-start-1",
          "col-start-1 row-start-2",
          "col-start-2 row-start-2 row-span-2",
          "col-start-1 row-start-3",
        ].map((cellClass, i) => (
          <div key={i} className={`${cellClass} overflow-hidden rounded-brand bg-gray`}>
            {gridPhotos[i] && (
              <img src={gridPhotos[i]} alt="" className="h-full w-full object-cover" />
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center justify-center gap-2">
        {Array.from({ length: dotCount }).map((_, i) => (
          <i
            key={i}
            className={`h-2 w-2 rounded-full ${i === activeDot ? "bg-green" : "bg-line"}`}
          />
        ))}
      </div>
    </div>
  );
}
