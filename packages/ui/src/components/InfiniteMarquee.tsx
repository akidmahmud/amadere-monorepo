"use client";

import { Children, type ReactNode } from "react";

/**
 * A continuously scrolling, seamlessly looping row.
 *
 * Replaces the "scroll a step, jump back to 0 at the end" carousels, which
 * visibly rewind. Here the children are rendered twice and the track is
 * translated by exactly -50%, so the moment the first copy has fully left the
 * viewport the second copy sits precisely where the first began and the loop
 * restarts invisibly.
 *
 * The gap is applied as a margin on each item rather than the flex `gap`
 * property, and that is load-bearing: with `gap`, a track of 2n items is
 * `2n*w + (2n-1)*g` wide, so -50% lands half a gap short and the seam drifts
 * on every cycle. As a per-item margin the width is exactly `2n*(w+g)` and
 * -50% is exactly one copy.
 *
 * Speed is expressed as `secondsPerItem` — how long one card takes to travel
 * its own width — so the visual speed stays constant no matter how many items
 * a section happens to have.
 */
export function InfiniteMarquee({
  children,
  secondsPerItem = 8,
  gapPx = 16,
  minPerCopy = 8,
  direction = "left",
  className,
  ariaLabel,
}: {
  children: ReactNode;
  /** Seconds for one item to travel its own width. Higher = slower. */
  secondsPerItem?: number;
  gapPx?: number;
  /**
   * Repeat the list until each half holds at least this many items, so a short
   * row still overflows the viewport. Tune it to the card width: wide product
   * cards fill a screen in ~8, narrow category tiles need more. Every extra
   * item is duplicated markup, so do not set it higher than the row needs.
   */
  minPerCopy?: number;
  /**
   * Which way the cards travel. "left" is the classic marquee — items enter
   * from the right and exit left. "right" reverses it, so the row reads in the
   * same direction as the text beside it.
   *
   * Implemented with `animation-direction: reverse` on the one shared
   * `marquee` keyframe rather than a second keyframe: the seam maths is
   * identical either way, and one definition cannot drift out of step with a
   * mirrored twin.
   */
  direction?: "left" | "right";
  className?: string;
  ariaLabel?: string;
}) {
  const items = Children.toArray(children);
  if (items.length === 0) return null;

  // A section with only a handful of cards (e.g. "Just For You" with 3) is
  // narrower than the screen, so translating by -50% would expose blank space
  // to the right for most of every cycle. Repeating the list until each half
  // overflows the viewport keeps the row continuously filled. Done by count
  // rather than by measuring, so server and client render identical markup —
  // no hydration mismatch, no reflow. A row that is already long enough
  // repeats once, i.e. not at all.
  const repeats = Math.max(1, Math.ceil(minPerCopy / items.length));
  const perCopy = Array.from({ length: repeats }, () => items).flat();

  // Speed still keyed to the real item count, so padding the row out does not
  // change how fast it moves.
  const duration = items.length * secondsPerItem;

  const copy = (isSecondHalf: boolean) =>
    perCopy.map((child, i) => (
      <div
        key={`${isSecondHalf ? "b" : "a"}-${i}`}
        className="shrink-0"
        style={{ marginInlineEnd: gapPx }}
        // Only the very first pass through the real list is exposed to
        // assistive tech and crawlers; every repeat after it is the same
        // cards again and would otherwise be announced over and over.
        aria-hidden={isSecondHalf || i >= items.length ? "true" : undefined}
      >
        {child}
      </div>
    ));

  return (
    <div
      className={`group relative overflow-hidden ${className ?? ""}`}
      aria-label={ariaLabel}
    >
      <div
        className={[
          "flex w-max",
          // motion-safe: someone who asked the OS for less motion gets a
          // plain scrollable row instead of a moving one.
          "motion-safe:animate-[marquee_var(--marquee-duration)_linear_infinite]",
          // Pause while a pointer is over the row, and while anything inside
          // has keyboard focus — otherwise a card slides out from under the
          // cursor mid-click, and tabbing through the links chases a moving
          // target.
          "group-hover:[animation-play-state:paused]",
          "group-focus-within:[animation-play-state:paused]",
          direction === "right" ? "[animation-direction:reverse]" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={
          { "--marquee-duration": `${duration}s` } as React.CSSProperties
        }
      >
        {/* Both halves are structurally identical, so each is exactly half
            the track and -50% lands precisely on the seam. */}
        <div className="flex">{copy(false)}</div>
        <div className="flex" aria-hidden="true">
          {copy(true)}
        </div>
      </div>
    </div>
  );
}
