"use client";

import { useEffect, useRef, useState } from "react";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { cn } from "../lib/cn";

export interface HeroSlide {
  imageUrl: string;
  linkUrl?: string;
}

export interface HeroCarouselProps {
  slides?: HeroSlide[];
  /** The reference design's fixed side banner — same slot as before (config.stripImageUrl/stripLinkUrl), now rendered beside the slider instead of as a strip underneath it. */
  stripImageUrl?: string;
  stripLinkUrl?: string;
  linkComponent?: LinkComponent;
  /** Only relevant with 2+ slides — how often it auto-advances. */
  autoplayMs?: number;
}

const prevIcon = (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);
const nextIcon = (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

// 16:5 matches the admin's recommended 1600×500 upload (see
// SectionConfigFields.tsx's "recommended image size" hint). Mobile is 3:2 —
// ~240px tall at a ~366px-wide slider (an iPhone-width viewport minus page
// padding), up from ~160px at the previous 16:7 — per explicit "240px from
// 160px" request. Progressively bumped taller each round (16:5.5 → 5:2 →
// 16:7 → 3:2); trades more left/right object-cover crop on a non-16:5
// upload for a more prominent mobile banner each step.
const sliderAspect = "aspect-[16/5] max-md:aspect-[3/2]";
// 5px radius at mobile (re-measured against the reference's `.hero.style-7`
// mobile slide — was the same 14px as desktop, notably more rounded than
// the reference's subtle 5px there).
const bannerRadius = "rounded-[14px] shadow-[0_6px_22px_rgba(30,43,34,.08)] max-md:rounded-[5px]";

// Both empty-state backgrounds (#e9dfcd tan, #dfe8d9 sage) are light, unlike
// the reference's own placeholder slides (dark gradients) — dark text/border
// here instead of the reference's white, or it's invisible on these tones.
function EmptySlot({ label }: { label: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2.5 p-5 text-center text-ink/70">
      <div className="rounded-[10px] border-[1.5px] border-dashed border-ink/30 px-[18px] py-2.5 text-[0.8rem] font-bold tracking-wide">{label}</div>
    </div>
  );
}

// Desktop only (mobile keeps its fixed object-fill — see the <img>'s
// className) — cover when the image's own aspect ratio is already close to
// the box's, since the crop is then barely noticeable; stretch (fill)
// otherwise, so a wildly different ratio doesn't lose content off the edges
// the way a big cover-crop would. 15% is a loose enough tolerance to prefer
// cover (mild crop, no distortion) whenever it wouldn't visibly hide much.
const COVER_TOLERANCE = 0.15;
function pickDesktopFit(imageRatio: number | undefined, boxRatio: number | null): "cover" | "fill" {
  if (!imageRatio || !boxRatio) return "cover";
  return Math.abs(imageRatio - boxRatio) / boxRatio <= COVER_TOLERANCE ? "cover" : "fill";
}

// Each slide owns its own ratio state (rather than a shared Record<index,
// ratio> on the parent) — that shared-state version had a real bug where a
// slide's computed fit used a *different* slide's ratio (state updates from
// several images loading in the same batch don't necessarily land before
// the sibling that reads them next re-renders). A self-contained component
// per <img> sidesteps that entirely: there's no cross-slide index to mix up.
function HeroSlideImage({ src, isDesktop, boxRatio }: { src: string; isDesktop: boolean; boxRatio: number | null }) {
  const [ratio, setRatio] = useState<number | undefined>(undefined);

  function recordRatio(el: HTMLImageElement) {
    if (!el.naturalWidth || !el.naturalHeight) return;
    const r = el.naturalWidth / el.naturalHeight;
    setRatio((prev) => (prev === r ? prev : r));
  }

  return (
    <img
      src={src}
      alt=""
      className="h-full w-full object-cover max-md:object-fill"
      style={isDesktop ? { objectFit: pickDesktopFit(ratio, boxRatio) } : undefined}
      // ref, not just onLoad — a browser-cached image can finish loading
      // before React attaches the onLoad listener, so `.complete` is
      // checked immediately too.
      ref={(el) => {
        if (el?.complete) recordRatio(el);
      }}
      onLoad={(e) => recordRatio(e.currentTarget)}
    />
  );
}

export function HeroCarousel({ slides, stripImageUrl, stripLinkUrl, linkComponent: Link = DefaultLink, autoplayMs = 5000 }: HeroCarouselProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Defense in depth: admin-entered config can end up with a slide that has
  // no image yet (e.g. "Add slide" clicked before an upload finishes) — an
  // empty imageUrl must never reach `<img src>`, so filter here regardless
  // of whether the admin form that produced this config already validates it.
  const validSlides = slides?.filter((slide) => slide.imageUrl) ?? [];
  const slideTotal = validSlides.length;

  // The box's own current ratio — its width is fluid (grid's 1fr track)
  // while its height is a fixed 400px on desktop, so the ratio genuinely
  // changes with viewport width and has to be re-measured on resize, not
  // assumed. Each slide's own image ratio lives in HeroSlideImage instead.
  const [isDesktop, setIsDesktop] = useState(false);
  const [boxRatio, setBoxRatio] = useState<number | null>(null);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const updateDesktop = () => setIsDesktop(mql.matches);
    updateDesktop();
    mql.addEventListener("change", updateDesktop);
    return () => mql.removeEventListener("change", updateDesktop);
  }, []);

  useEffect(() => {
    if (!isDesktop) return;
    function measure() {
      const rect = boxRef.current?.getBoundingClientRect();
      if (rect && rect.height > 0) setBoxRatio(rect.width / rect.height);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [isDesktop]);

  useEffect(() => {
    if (slideTotal <= 1 || paused) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % slideTotal), autoplayMs);
    return () => clearInterval(timer);
  }, [slideTotal, autoplayMs, paused]);

  function go(delta: number) {
    setIndex((i) => (i + delta + slideTotal) % slideTotal);
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 py-6 max-md:px-3 max-md:pb-4 max-md:pt-5">
      {/* Main slider (flex:1, 400px tall on desktop) + fixed 400×400 side
          banner — both explicitly 400px tall on desktop so they match with
          no gap. Stacks to a single column at ≤1024px. */}
      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-[1fr_400px]">
        <div
          // lg:aspect-auto lg:h-[400px] — overrides sliderAspect's
          // aspect-[16/5] at desktop with a fixed height instead, matching
          // the side banner's own fixed 400px so the row has no leftover
          // gap. Mixing an explicit height with aspect-ratio (rather than
          // canceling the ratio via aspect-auto) is exactly what caused the
          // side banner to get shoved off-screen earlier — aspect-ratio
          // would compute a *preferred width* from the explicit height
          // (400×16/5=1280px) and blow through the 1fr grid column. self-
          // start keeps this box from being stretched by items-stretch to
          // match the side banner at breakpoints where the override above
          // isn't active (≤1024px, before the side banner even shows).
          ref={boxRef}
          className={cn("relative self-start overflow-hidden bg-[#e9dfcd] lg:aspect-auto lg:h-[400px]", sliderAspect, bannerRadius)}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={(e) => (touchStartX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchStartX.current === null || slideTotal <= 1) return;
            const dx = e.changedTouches[0].clientX - touchStartX.current;
            if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
            touchStartX.current = null;
          }}
        >
          {slideTotal === 0 ? (
            <EmptySlot label="Add a hero slide" />
          ) : (
            <>
              <div className="absolute inset-0">
                {validSlides.map((slide, i) => {
                  // Desktop object-fit is picked per-image by HeroSlideImage
                  // (cover when its own ratio is already close to the box's,
                  // fill/stretch otherwise) rather than one fixed rule for
                  // every slide. Mobile is untouched — stays the fixed
                  // object-fill ("stretch") baked into that component's own
                  // className, since its inline style override only applies
                  // when isDesktop is true.
                  const img = <HeroSlideImage src={slide.imageUrl} isDesktop={isDesktop} boxRatio={boxRatio} />;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "absolute inset-0 flex items-center justify-center transition-opacity duration-[550ms] ease-in-out",
                        i === index ? "z-[1] opacity-100" : "opacity-0",
                      )}
                    >
                      {slide.linkUrl ? <Link href={slide.linkUrl}>{img}</Link> : img}
                    </div>
                  );
                })}
              </div>
              {slideTotal > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous slide"
                    onClick={() => go(-1)}
                    className="absolute left-4 top-1/2 z-[3] grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-green shadow-[0_4px_14px_rgba(30,43,34,.22)] transition-[background-color,color,transform] hover:bg-green hover:text-white active:scale-[0.94]"
                  >
                    {prevIcon}
                  </button>
                  <button
                    type="button"
                    aria-label="Next slide"
                    onClick={() => go(1)}
                    className="absolute right-4 top-1/2 z-[3] grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-green shadow-[0_4px_14px_rgba(30,43,34,.22)] transition-[background-color,color,transform] hover:bg-green hover:text-white active:scale-[0.94]"
                  >
                    {nextIcon}
                  </button>
                  {/* Overlaid on the image at md+ (matches the reference's
                      desktop hero) — hidden at mobile, where the reference
                      instead puts a separate dot row below the image
                      (own row, 15px margin-top, centered, not overlaid). */}
                  <div className="absolute bottom-4 left-6 z-[3] hidden gap-2 md:flex">
                    {validSlides.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        aria-label={`Go to slide ${i + 1}`}
                        onClick={() => setIndex(i)}
                        className={cn(
                          "h-[9px] rounded-full transition-[width,background-color] duration-200",
                          i === index ? "w-[22px] rounded-[5px] bg-gold" : "w-[9px] bg-white/55",
                        )}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {slideTotal > 1 && (
          <div className="flex justify-center gap-2 pt-[15px] md:hidden">
            {validSlides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={cn(
                  "h-[9px] rounded-full transition-[width,background-color] duration-200",
                  i === index ? "w-[22px] rounded-[5px] bg-[#F48721]" : "w-[9px] bg-[#dddddd]",
                )}
              />
            ))}
          </div>
        )}

        {stripImageUrl ? (
          (() => {
            const bannerImg = <img src={stripImageUrl} alt="" className="h-full w-full object-cover" />;
            // Fixed 400×400 square, matching the main slider's own
            // lg:h-[400px] override above so the two sit at equal height
            // with no gap. Hidden below lg entirely (not just stacked) —
            // per earlier explicit request, the side banner shouldn't show
            // on mobile at all, not even below the slider.
            const bannerClass = cn("relative hidden overflow-hidden bg-[#dfe8d9] lg:block lg:h-[400px] lg:w-[400px]", bannerRadius);
            return stripLinkUrl ? (
              <Link href={stripLinkUrl} className={bannerClass}>
                {bannerImg}
              </Link>
            ) : (
              <div className={bannerClass}>{bannerImg}</div>
            );
          })()
        ) : (
          <div className={cn("relative hidden overflow-hidden bg-[#dfe8d9] lg:block lg:h-[400px] lg:w-[400px]", bannerRadius)}>
            <EmptySlot label="Add a side banner" />
          </div>
        )}
      </div>
    </div>
  );
}
