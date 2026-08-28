"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { cn } from "../lib/cn";

export interface HeroSlide {
  imageUrl: string;
  linkUrl?: string;
}

export interface HeroCarouselProps {
  slides?: HeroSlide[];
  /** The reference design's fixed side banner slot, rendered beside the
   * slider on desktop. 2+ entries auto-rotate on the same autoplayMs
   * interval as the main slides, crossfading — no arrows/dots, per explicit
   * request (this slot is meant to stay visually quiet next to the main
   * slider's own controls). */
  sideBanners?: HeroSlide[];
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

// 16:5 everywhere, mobile included — matches the admin's recommended
// 1600×500 upload exactly (see SectionConfigFields.tsx's "recommended image
// size" hint), per explicit "make the box match the image" request. With
// the box and a correctly-sized upload sharing the same ratio, cover/
// contain/fill all render identically (no crop, no stretch, no letterbox) —
// mobile had cycled through all three chasing this same goal by adjusting
// object-fit alone, which never fully worked while the box itself (3:2 at
// its last setting) stayed a different ratio from the image.
const sliderAspect = "aspect-[16/5]";
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

// Desktop only — mobile is a fixed object-cover regardless of ratio (see
// the <img>'s className). Cover when the image's own aspect ratio is
// already close to the box's, since the crop is then barely noticeable;
// stretch (fill) otherwise, so a wildly different ratio doesn't lose
// content off the edges the way a big cover-crop would. 15% is a loose
// enough tolerance to prefer cover (mild crop, no distortion) whenever it
// wouldn't visibly hide much.
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
function HeroSlideImage({
  src,
  isDesktop,
  boxRatio,
  priority,
}: {
  src: string;
  isDesktop: boolean;
  boxRatio: number | null;
  priority: boolean;
}) {
  const [ratio, setRatio] = useState<number | undefined>(undefined);

  function recordRatio(el: HTMLImageElement) {
    if (!el.naturalWidth || !el.naturalHeight) return;
    const r = el.naturalWidth / el.naturalHeight;
    setRatio((prev) => (prev === r ? prev : r));
  }

  return (
    <Image
      src={src}
      alt=""
      fill
      // Only the very first slide is ever the initial paint (later ones are
      // switched to client-side by clicking a dot/arrow) — same "priority
      // only on what's actually the LCP candidate" rule as ProductGallery.
      priority={priority}
      // Lighthouse's "LCP request discovery" audit flags this image for
      // missing fetchpriority=high. `priority` alone puts a preload in the
      // head but does not mark the element itself, so the browser still
      // schedules it against everything else competing for bandwidth.
      // Measured LCP breakdown: the file downloads in 30 ms — the cost is
      // all in waiting, not transfer.
      fetchPriority={priority ? "high" : undefined}
      sizes="(max-width: 1024px) 100vw, 70vw"
      // Mobile is object-contain per explicit "need to see the full image"
      // request — the only mode that shows 100% of the image with no crop
      // and no distortion. Tradeoff: a 1600×500 (3.2:1) upload in the 3:2
      // mobile box shows letterbox bars (this component's bg color) above/
      // below the image, since contain can't fill a box whose ratio doesn't
      // match without either cropping (object-cover, tried before this) or
      // stretching (object-fill, tried before that).
      className="object-cover max-md:object-contain"
      style={isDesktop ? { objectFit: pickDesktopFit(ratio, boxRatio) } : undefined}
      // ref, not just onLoad — a browser-cached image can finish loading
      // before React attaches the onLoad listener, so `.complete` is
      // checked immediately too. next/image forwards both straight to the
      // underlying <img>, so this measurement logic is unchanged.
      ref={(el) => {
        if (el?.complete) recordRatio(el);
      }}
      onLoad={(e) => recordRatio(e.currentTarget)}
    />
  );
}

// Side banner's square size N, solved so it exactly equals the main
// slider's own rendered height once the grid column split accounts for N —
// otherwise this is circular (the slider's height depends on its width,
// which depends on how much room N leaves it, which is exactly the value
// we're trying to compute). With mainSliderWidth = C - N - gap and
// height = mainSliderWidth × 5/16 (aspect-[16/5]), setting N = height and
// solving for N gives a closed form instead of a measure-then-adjust loop:
//   N = (C - N - gap) × 5/16  →  21N = 5(C - gap)  →  N = 5(C - gap) / 21
const GRID_GAP = 20;
function solveSideBannerSize(containerWidth: number): number {
  return Math.round((5 * (containerWidth - GRID_GAP)) / 21);
}

export function HeroCarousel({ slides, sideBanners, linkComponent: Link = DefaultLink, autoplayMs = 5000 }: HeroCarouselProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const validSideBanners = sideBanners?.filter((b) => b.imageUrl) ?? [];
  const sideBannerTotal = validSideBanners.length;
  const [sideIndex, setSideIndex] = useState(0);
  const [sidePaused, setSidePaused] = useState(false);

  // Defense in depth: admin-entered config can end up with a slide that has
  // no image yet (e.g. "Add slide" clicked before an upload finishes) — an
  // empty imageUrl must never reach `<img src>`, so filter here regardless
  // of whether the admin form that produced this config already validates it.
  const validSlides = slides?.filter((slide) => slide.imageUrl) ?? [];
  const slideTotal = validSlides.length;

  const [isDesktop, setIsDesktop] = useState(false);
  // Fixed 16:5 always (sliderAspect enforces this unconditionally at
  // desktop) — not measured, since the ratio no longer varies with
  // viewport width the way it did back when the slider had a fixed pixel
  // height instead of a fixed aspect-ratio.
  const boxRatio = isDesktop ? 16 / 5 : null;
  const [sideBannerSize, setSideBannerSize] = useState<number | null>(null);

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
      const width = gridRef.current?.clientWidth;
      if (width) setSideBannerSize(solveSideBannerSize(width));
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

  // Independent index/timer from the main slider — counts can differ, and
  // there's no reason the two rotations need to stay in lockstep.
  useEffect(() => {
    if (sideBannerTotal <= 1 || sidePaused) return;
    const timer = setInterval(() => setSideIndex((i) => (i + 1) % sideBannerTotal), autoplayMs);
    return () => clearInterval(timer);
  }, [sideBannerTotal, autoplayMs, sidePaused]);

  function go(delta: number) {
    setIndex((i) => (i + delta + slideTotal) % slideTotal);
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 py-6 max-md:px-3 max-md:pb-4 max-md:pt-5">
      {/* Main slider (aspect-[16/5], matches a 1600×500 upload) + a square
          side banner sized so it exactly equals the slider's own rendered
          height (solveSideBannerSize) — e.g. 330px side banner when the
          slider itself is 330px tall, recomputed on resize since the
          slider's height is fluid (aspect-[16/5] on a 1fr-track width, not
          a fixed pixel value). lg:grid-cols-[1fr_300px] is just the pre-JS/
          SSR default the inline gridTemplateColumns style overrides once
          isDesktop and the computed size are known. Stacks to a single
          column at ≤1024px. */}
      <div
        ref={gridRef}
        className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-[1fr_300px]"
        style={isDesktop && sideBannerSize ? { gridTemplateColumns: `1fr ${sideBannerSize}px` } : undefined}
      >
        <div
          // Desktop box is aspect-[16/5] (via sliderAspect) — matches the
          // admin's recommended 1600×500 upload exactly, so a correctly
          // sized image gets object-cover with ~0% crop (see HeroSlideImage's
          // per-image fit logic). self-start — the side banner next to it
          // has its own explicit height (solveSideBannerSize, set via inline
          // style); without self-start, items-stretch would pull this box's
          // height up to match it, and that stretched height combined with
          // aspect-[16/5] would compute a *preferred width* from the ratio,
          // blowing through the 1fr grid column (this exact bug happened
          // once already with a fixed-400px side banner — see git history
          // if it resurfaces).
          className={cn("group relative self-start overflow-hidden bg-[#e9dfcd]", sliderAspect, bannerRadius)}
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
                  const img = <HeroSlideImage src={slide.imageUrl} isDesktop={isDesktop} boxRatio={boxRatio} priority={i === 0} />;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "absolute inset-0 flex items-center justify-center transition-opacity duration-[550ms] ease-in-out",
                        i === index ? "z-[1] opacity-100" : "opacity-0",
                      )}
                    >
                      {/* A linked banner whose only content is an image with
                          alt="" is a link with no accessible name — a screen
                          reader announces "link" and nothing else. A slide
                          carries only imageUrl + linkUrl, so there is no real
                          text to use; the index at least makes each one
                          distinguishable and announceable. Per-slide alt text
                          entered in the admin is the proper fix. */}
                      {slide.linkUrl ? (
                        <Link href={slide.linkUrl} aria-label={`Promotion ${i + 1}`}>
                          {img}
                        </Link>
                      ) : (
                        img
                      )}
                    </div>
                  );
                })}
              </div>
              {slideTotal > 1 && (
                <>
                  {/* Desktop only (hidden below md — no arrows on mobile,
                      swipe already covers it via onTouchStart/End above), and
                      only revealed on hover/focus of the slider (opacity-0
                      until the parent's :hover/:focus-within), not shown at
                      rest — per explicit request. Clicking blurs the button
                      right after — without it, a mouse click leaves the
                      button holding keyboard focus, and group-focus-within
                      alone kept the arrow visible (stuck showing) even after
                      the mouse left, until something else took focus. Only
                      matters for a real click (mouse or Enter/Space on a
                      focused button already showing it) — Tab-focusing it
                      via keyboard still reveals it via group-focus-within
                      exactly as before. */}
                  <button
                    type="button"
                    aria-label="Previous slide"
                    onClick={(e) => {
                      go(-1);
                      e.currentTarget.blur();
                    }}
                    className="absolute left-4 top-1/2 z-[3] hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-green opacity-0 shadow-[0_4px_14px_rgba(30,43,34,.22)] transition-[background-color,color,transform,opacity] group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-green hover:text-white active:scale-[0.94] md:grid"
                  >
                    {prevIcon}
                  </button>
                  <button
                    type="button"
                    aria-label="Next slide"
                    onClick={(e) => {
                      go(1);
                      e.currentTarget.blur();
                    }}
                    className="absolute right-4 top-1/2 z-[3] hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-green opacity-0 shadow-[0_4px_14px_rgba(30,43,34,.22)] transition-[background-color,color,transform,opacity] group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-green hover:text-white active:scale-[0.94] md:grid"
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

        {sideBannerTotal > 0 ? (
          // Square, sized to exactly match the main slider's own rendered
          // height (solveSideBannerSize) — 330px side banner when the
          // slider is 330px tall, 300px when it's 300px, etc., recomputed
          // on resize. lg:h-[300px] lg:w-[300px] is just the pre-JS/SSR
          // default the inline style overrides once isDesktop and the
          // computed size are known. Hidden below lg entirely (not just
          // stacked) — per earlier explicit request, the side banner
          // shouldn't show on mobile at all, not even below the slider.
          // 2+ entries crossfade on their own timer — no arrows/dots here,
          // unlike the main slider (per explicit request).
          <div
            className={cn("relative hidden overflow-hidden bg-[#dfe8d9] lg:block lg:h-[300px] lg:w-[300px]", bannerRadius)}
            style={isDesktop && sideBannerSize ? { width: sideBannerSize, height: sideBannerSize } : undefined}
            onMouseEnter={() => setSidePaused(true)}
            onMouseLeave={() => setSidePaused(false)}
          >
            {validSideBanners.map((banner, i) => {
              const bannerImg = <Image src={banner.imageUrl} alt="" fill sizes="300px" className="object-cover" />;
              return (
                <div
                  key={i}
                  className={cn(
                    "absolute inset-0 transition-opacity duration-[550ms] ease-in-out",
                    i === sideIndex ? "z-[1] opacity-100" : "opacity-0",
                  )}
                >
                  {banner.linkUrl ? (
                    // Same nameless-link problem as the main slides above.
                    <Link href={banner.linkUrl} aria-label={`Promotion banner ${i + 1}`}>
                      {bannerImg}
                    </Link>
                  ) : (
                    bannerImg
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className={cn("relative hidden overflow-hidden bg-[#dfe8d9] lg:block lg:h-[300px] lg:w-[300px]", bannerRadius)}
            style={isDesktop && sideBannerSize ? { width: sideBannerSize, height: sideBannerSize } : undefined}
          >
            <EmptySlot label="Add a side banner" />
          </div>
        )}
      </div>
    </div>
  );
}
