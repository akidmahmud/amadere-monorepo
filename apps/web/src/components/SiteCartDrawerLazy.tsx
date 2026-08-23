"use client";

import dynamic from "next/dynamic";

/**
 * The cart drawer is closed on every initial page load, yet its code — plus
 * the cross-sell row, line items and upsell progress bar it pulls in — shipped
 * in the first-load bundle of every route.
 *
 * This wrapper exists because `next/dynamic` with `ssr: false` is only valid
 * inside a client component, and the root layout that renders the drawer is a
 * Server Component.
 *
 * The chunk is fetched right after hydration rather than on first open, so
 * tapping the cart never waits on a network request — the saving is in what
 * the main bundle has to parse and execute before the page is interactive,
 * which is what Total Blocking Time measures.
 */
const SiteCartDrawer = dynamic(
  () => import("./SiteCartDrawer").then((m) => m.SiteCartDrawer),
  { ssr: false },
);

export function SiteCartDrawerLazy() {
  return <SiteCartDrawer />;
}
