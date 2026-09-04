/**
 * The action bar at the top of a long editor form — Cancel / Delete / Preview /
 * Save & Exit / Save — pinned so it stays reachable.
 *
 * These forms are long enough that Save sits off-screen for most of the
 * editing, so every small change cost a scroll back to the top.
 *
 * - `top-16` parks the bar directly under AppShell's own sticky `h-16` header.
 * - `z-[5]` stays below that header's `z-10`, so the two can never fight.
 * - `-mx-6 -mt-6 px-6 py-4` cancels `<main>`'s `px-6 py-6`, so the bar spans the
 *   full width and sits flush. Without it, page content would scroll through the
 *   24px gutters either side of the bar. This relies on every ancestor between
 *   `<main>` and the bar being unpadded — true for all current call sites.
 * - `bg-surface` + `border-b` so content scrolls behind the bar, not through it.
 *
 * One constant rather than eight copies of the class string, because the
 * `top-16`/`z-[5]`/`-mx-6` values are only correct in relation to AppShell and
 * would silently drift apart if each page kept its own.
 */
export const STICKY_FORM_HEADER =
  "sticky top-16 z-[5] -mx-6 -mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-6 py-4";
