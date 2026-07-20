"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";

export interface ProductInfoVisualArrow {
  heading?: string | null;
  subheading?: string | null;
}

export interface ProductInfoVisualCircle {
  imageUrl?: string | null;
  label?: string | null;
}

export interface ProductInfoVisualProps {
  mainImageUrl?: string | null;
  /** Admin-authored HTML (same trust level as description/content elsewhere). */
  topHeadingHtml?: string | null;
  /** Admin-authored HTML. */
  bottomHeadingHtml?: string | null;
  /** Exactly 4, in fixed position order: [top-left, bottom-left, top-right, bottom-right]. */
  arrows: ProductInfoVisualArrow[];
  /** Exactly 3, shown left-to-right. */
  circles: ProductInfoVisualCircle[];
}

const RING_COLORS = ["border-gold", "border-[#3b6fd1]", "border-[#e05a5a]"];

// Exact hand-designed arrow art (one per position, not mirrors of each other
// — each has its own curve). Each one's "tail" (the plain end, no
// arrowhead) sits at a specific corner of its own viewBox; that corner is
// what gets anchored to the measured caption position below.
const TopLeftArrow = () => (
  <svg width="170" height="180" viewBox="0 0 170 180" fill="none">
    <path
      d="M10 20 C60 5, 85 25, 90 70 C95 125, 120 145, 160 145"
      stroke="white"
      strokeWidth="6"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path d="M140 125L160 145L140 165" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const BottomLeftArrow = () => (
  <svg width="180" height="160" viewBox="0 0 180 160" fill="none">
    <path
      d="M5 145 C55 150, 75 145, 90 115 C105 85, 100 40, 140 25 C155 20, 165 20, 175 20"
      stroke="white"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path d="M155 1 L175 20 L155 39" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const TopRightArrow = () => (
  <svg width="140" height="180" viewBox="0 0 140 180" fill="none">
    <path
      d="M125 10 C95 30, 100 95, 75 145 C55 185, 20 160, 10 145"
      stroke="white"
      strokeWidth="6"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path d="M35 145 L10 145 L10 170" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const BottomRightArrow = () => (
  <svg width="180" height="209" viewBox="0 0 500 580" fill="none">
    <path
      d="M455 75 C340 130 250 220 245 320 C242 385 270 450 205 455 C155 460 120 450 85 438"
      stroke="white"
      strokeWidth="22"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path d="M85 438 L165 380" stroke="white" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M85 438 L145 515" stroke="white" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

// index order matches [topLeft, bottomLeft, topRight, bottomRight] throughout.
// tailX/tailY = the exact coordinate (in the SVG's own viewBox) where each
// path's "M" starts — the plain end, no arrowhead. That specific point (not
// a bounding-box corner approximation) is what gets aligned to the measured
// caption position, so the drawn tail always starts exactly at the caption
// regardless of where within its own box that point happens to sit.
const ARROW_META = [
  { Svg: TopLeftArrow, width: 170, height: 180, tailX: 10, tailY: 20, flipY: false },
  { Svg: BottomLeftArrow, width: 180, height: 160, tailX: 5, tailY: 145, flipY: false },
  { Svg: TopRightArrow, width: 140, height: 180, tailX: 125, tailY: 10, flipY: false },
  // Given at 500x580 (viewBox, unchanged so the path data doesn't need
  // touching) but rendered at 180x209 — the <svg>'s own width/height attrs
  // do the scaling. tailX/tailY are scaled by the same 0.36 factor (455,75
  // → 164,27) since the positioning math below treats them as being in the
  // same units as this rendered width/height, not the original viewBox.
  { Svg: BottomRightArrow, width: 180, height: 209, tailX: 164, tailY: 27, flipY: true },
];

function ArrowCaption({
  arrow,
  align,
  innerRef,
}: {
  arrow: ProductInfoVisualArrow;
  align: "left" | "right";
  innerRef: React.RefObject<HTMLDivElement | null>;
}) {
  if (!arrow.heading && !arrow.subheading) return <div ref={innerRef} />;
  return (
    <div ref={innerRef} className={cn("max-w-[440px]", align === "right" ? "ml-auto text-right" : "text-left")}>
      {arrow.heading && (
        // eslint-disable-next-line react/no-danger
        <p className="font-serif text-[32px] font-bold leading-tight text-green" dangerouslySetInnerHTML={{ __html: arrow.heading }} />
      )}
      {arrow.subheading && (
        // eslint-disable-next-line react/no-danger
        <p className="mt-2 font-body text-[24px] leading-relaxed text-ink/70" dangerouslySetInnerHTML={{ __html: arrow.subheading }} />
      )}
    </div>
  );
}

// Gold gradient background is vector (viewBox scaled with preserveAspectRatio
// "none") — unlike MarketingReviewSection's raster scene, this stretches to
// exactly fill any height with zero crop risk, so content height can drive
// the box freely here. Wave cutouts and the gradient's own bottom stop use
// #FBF7F1 (the site's actual cream page background) instead of pure white —
// pure white clashed visibly against it at the section's edges.
export function ProductInfoVisual({
  mainImageUrl,
  topHeadingHtml,
  bottomHeadingHtml,
  arrows,
  circles,
}: ProductInfoVisualProps) {
  const [topLeft, bottomLeft, topRight, bottomRight] = arrows;
  const orderedArrows = [topLeft, bottomLeft, topRight, bottomRight];

  const gridRef = useRef<HTMLDivElement>(null);
  const topLeftRef = useRef<HTMLDivElement>(null);
  const bottomLeftRef = useRef<HTMLDivElement>(null);
  const topRightRef = useRef<HTMLDivElement>(null);
  const bottomRightRef = useRef<HTMLDivElement>(null);
  const capRefs = [topLeftRef, bottomLeftRef, topRightRef, bottomRightRef];

  // { left, top } in px, relative to gridRef — the top-left CSS position an
  // absolutely-positioned arrow needs so that ITS anchor corner (per
  // ARROW_META, matching where each hand-drawn arrow's tail actually sits
  // in its own viewBox) lands exactly on the caption's real edge. Captions
  // are right/left-aligned within a flexible (`1fr`) column while the arrow
  // art itself is fixed-size, so this still has to be measured at runtime,
  // not hardcoded — a fixed pixel/percentage position was wrong at any
  // viewport width other than the one it was tuned against.
  const [positions, setPositions] = useState<({ left: number; top: number } | null)[]>([null, null, null, null]);

  useEffect(() => {
    function measure() {
      const grid = gridRef.current;
      if (!grid || capRefs.some((ref) => !ref.current)) return;
      const gridRect = grid.getBoundingClientRect();

      const newPositions = capRefs.map((ref, i) => {
        const arrow = orderedArrows[i];
        if (!arrow?.heading && !arrow?.subheading) return null;
        const el = ref.current;
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const isLeft = i === 0 || i === 1;
        const meta = ARROW_META[i];
        const anchorX = (isLeft ? r.right : r.left) - gridRect.left;
        const anchorY = r.top - gridRect.top + r.height / 2;
        // Position the box so its own (tailX, tailY) point — the artwork's
        // actual drawn starting point — lands exactly on (anchorX, anchorY).
        const left = anchorX - meta.tailX;
        const top = anchorY - meta.tailY;
        return { left, top };
      });
      setPositions(newPositions);
    }

    measure();
    const observer = new ResizeObserver(measure);
    if (gridRef.current) observer.observe(gridRef.current);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainImageUrl, topLeft?.heading, bottomLeft?.heading, topRight?.heading, bottomRight?.heading]);

  if (!mainImageUrl && !topHeadingHtml && !bottomHeadingHtml) return null;

  return (
    <div className="relative overflow-hidden">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1440 1200" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="pivBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFD51E" />
            <stop offset="45%" stopColor="#FFE680" />
            <stop offset="70%" stopColor="#FFF4CC" />
            <stop offset="100%" stopColor="#FBF7F1" />
          </linearGradient>
        </defs>
        <rect width="1440" height="1200" fill="url(#pivBg)" />
        <path fill="#FBF7F1" d="M0 80 C200 -20 450 -10 700 40 C950 90 1200 100 1440 20 L1440 0 L0 0 Z" />
        <path fill="#FBF7F1" d="M0 1120 C250 1040 450 1060 700 1120 C1000 1190 1200 1230 1440 1080 L1440 1200 L0 1200 Z" />
      </svg>

      <div className="relative z-[1] mx-auto max-w-[2200px] px-5 py-40">
        {topHeadingHtml && (
          // eslint-disable-next-line react/no-danger
          <h2 className="mb-24 text-center font-serif text-[48px] font-bold leading-snug" dangerouslySetInnerHTML={{ __html: topHeadingHtml }} />
        )}

        <div ref={gridRef} className="relative mx-auto grid max-w-[1800px] grid-cols-[1fr_auto_1fr] items-center gap-8">
          {positions.map((pos, i) => {
            if (!pos) return null;
            const { Svg, width, height, tailX, tailY, flipY } = ARROW_META[i];
            return (
              <div
                key={i}
                className="pointer-events-none absolute"
                style={{
                  left: pos.left,
                  top: pos.top,
                  width,
                  height,
                  transform: flipY ? "scaleY(-1)" : undefined,
                  transformOrigin: flipY ? `${tailX}px ${tailY}px` : undefined,
                }}
              >
                <Svg />
              </div>
            );
          })}

          <div className="flex flex-col justify-between gap-64 py-12 pr-16">
            <ArrowCaption arrow={topLeft ?? {}} align="right" innerRef={topLeftRef} />
            <ArrowCaption arrow={bottomLeft ?? {}} align="right" innerRef={bottomLeftRef} />
          </div>

          {mainImageUrl ? (
            <div className="relative z-[1] w-[440px] shrink-0 sm:w-[520px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mainImageUrl} alt="" className="h-auto w-full object-contain drop-shadow-lg" />
            </div>
          ) : (
            <div className="w-[440px] sm:w-[520px]" />
          )}

          <div className="flex flex-col justify-between gap-64 py-12">
            <ArrowCaption arrow={topRight ?? {}} align="left" innerRef={topRightRef} />
            <ArrowCaption arrow={bottomRight ?? {}} align="left" innerRef={bottomRightRef} />
          </div>
        </div>

        {bottomHeadingHtml && (
          // eslint-disable-next-line react/no-danger
          <h2 className="mb-16 mt-32 text-center font-serif text-[48px] font-bold leading-snug" dangerouslySetInnerHTML={{ __html: bottomHeadingHtml }} />
        )}

        {circles.some((c) => c.imageUrl) && (
          <div className="flex flex-wrap justify-center gap-20">
            {circles.map((circle, i) =>
              circle.imageUrl ? (
                <div key={i} className="flex flex-col items-center gap-4">
                  <div
                    className={cn(
                      "h-48 w-48 overflow-hidden rounded-full border-8 bg-white",
                      RING_COLORS[i % RING_COLORS.length],
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={circle.imageUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                  {circle.label && <p className="font-ui text-[28px] text-ink">{circle.label}</p>}
                </div>
              ) : null,
            )}
          </div>
        )}
      </div>
    </div>
  );
}
