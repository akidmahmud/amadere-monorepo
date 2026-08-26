"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { RatingStars } from "@amader/ui";
import { toDisplayImageUrl, IMG } from "@/lib/media";

type Review = {
  id: number;
  rating: number;
  comment: string | null;
  images: string[];
  customerName: string;
  reply: { message: string; createdAt: string } | null;
};

/**
 * Reviews as an auto-advancing carousel on phones, one card at a time, and as
 * the plain stacked list on tablet and up. Paginated — the server renders the
 * first page and "Load more" appends the next.
 *
 * The layout switch is pure CSS (a horizontal scroll-snap strip below `sm`, a
 * normal column above it), so there is one DOM tree rather than two and the
 * review text is never duplicated in the markup for search engines.
 *
 * The first page stays server-rendered and arrives as `children`, so the
 * reviews that matter for SEO and first paint cost no JavaScript. Only pages
 * the visitor explicitly asks for are fetched and rendered client-side.
 */
export function ReviewsCarousel({
  children,
  productId,
  initialCount,
  total,
  pageSize,
}: {
  children: React.ReactNode;
  productId: number;
  initialCount: number;
  total: number;
  pageSize: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [extra, setExtra] = useState<Review[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const count = initialCount + extra.length;
  const hasMore = count < total;

  // Autoplay pauses for a while after any manual interaction — an advance
  // firing mid-swipe fights the user for control of the scroll position.
  const pausedUntil = useRef(0);
  const pause = useCallback(() => {
    pausedUntil.current = Date.now() + 8000;
  }, []);

  // Keep the dots in step with wherever the strip actually is, however it got
  // there — autoplay, a swipe, or a dot tap.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const w = el.clientWidth;
        if (w > 0) setIndex(Math.round(el.scrollLeft / w));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    if (count < 2) return;
    const el = trackRef.current;
    if (!el) return;

    // Someone who asked the OS for less motion should not get a carousel that
    // moves on its own.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const tick = () => {
      // Above `sm` the CSS makes this a normal column, so there is nothing to
      // scroll. Checked per tick rather than once, so a rotation or a resized
      // desktop window is handled without re-mounting.
      if (el.scrollWidth <= el.clientWidth) return;
      if (Date.now() < pausedUntil.current) return;
      if (document.hidden) return;

      const w = el.clientWidth;
      const current = Math.round(el.scrollLeft / w);
      const next = current + 1 >= count ? 0 : current + 1;
      el.scrollTo({ left: next * w, behavior: "smooth" });
    };

    const id = window.setInterval(tick, 4500);
    return () => window.clearInterval(id);
  }, [count]);

  const goTo = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    pause();
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  const loadMore = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setFailed(false);
    pause();
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
      const res = await fetch(
        `${base}/api/v1/products/${productId}/reviews?page=${page + 1}&pageSize=${pageSize}`,
      );
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { data?: { items?: Review[] } };
      const items = body.data?.items ?? [];
      // Guard against a duplicate id slipping in if a new review lands between
      // page requests and shifts the offset window.
      setExtra((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...items.filter((r) => !seen.has(r.id))];
      });
      setPage((p) => p + 1);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-8">
      <div
        ref={trackRef}
        onPointerDown={pause}
        onTouchStart={pause}
        onKeyDown={pause}
        // Below sm: a snapping horizontal strip. From sm up: a plain column,
        // identical to what this section rendered before.
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain [scrollbar-width:none] sm:snap-none sm:flex-col sm:gap-4 sm:overflow-x-visible [&::-webkit-scrollbar]:hidden"
      >
        {children}
        {extra.map((review) => (
          <div
            key={review.id}
            className="w-full shrink-0 snap-center rounded-brand border border-line bg-white p-4 sm:w-auto sm:shrink"
          >
            <div className="mb-1.5 flex items-center justify-between">
              <span className="font-ui text-sm font-semibold text-ink">
                {review.customerName}
              </span>
              <RatingStars rating={review.rating} />
            </div>
            {review.comment && (
              <p className="font-body text-sm text-muted">{review.comment}</p>
            )}
            {review.images.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {review.images.map((url) => (
                  <Image
                    key={url}
                    src={toDisplayImageUrl(url, IMG.icon) ?? url}
                    alt=""
                    width={64}
                    height={64}
                    className="h-16 w-16 rounded-lg border border-line object-cover"
                  />
                ))}
              </div>
            )}
            {review.reply && (
              <p className="mt-2 border-l-2 border-green pl-3 font-body text-xs text-muted">
                <span className="font-semibold text-ink">Reply: </span>
                {review.reply.message}
              </p>
            )}
          </div>
        ))}
      </div>

      {count > 1 && (
        <div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:hidden">
          {Array.from({ length: count }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to review ${i + 1} of ${count}`}
              aria-current={i === index || undefined}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-4 bg-[#F48721]" : "w-1.5 bg-[#ddd]"
              }`}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="rounded-brand border border-line px-5 py-2 font-ui text-sm font-semibold text-ink transition-colors hover:bg-[#faf7f2] disabled:opacity-60"
          >
            {loading ? "Loading…" : `Load more reviews (${total - count} left)`}
          </button>
          {failed && (
            <p className="mt-2 font-body text-xs text-muted">
              Couldn&apos;t load more reviews. Please try again.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
