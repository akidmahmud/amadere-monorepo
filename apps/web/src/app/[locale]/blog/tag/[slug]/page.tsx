import { permanentRedirect } from "@/i18n/navigation";

// Blog tags no longer get their own browsable page (explicit request — they
// are plain labels on a post now, see blog/[slug]/post-detail.tsx, and still
// drive Related Posts via shared-tag matching server-side).
//
// This route is kept as a REDIRECT rather than deleted: the migration's
// redirect table holds 360 legacy `/tag/{slug}` → `/blog/tag/{slug}` rows,
// so deleting the route outright would turn every one of those old,
// potentially-indexed URLs into a 308-then-404 chain. Sending them to the
// blog index instead keeps them landing on real content.
//
// permanentRedirect from @/i18n/navigation (not next/navigation) — the raw
// one silently degrades to a client-side-only redirect under this app's
// locale routing and returns HTTP 200; the locale-aware wrapper emits a real
// 308. Same trap documented in lib/redirects.ts.
export default async function BlogTagRedirect({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale } = await params;
  permanentRedirect({ href: "/blog", locale });
}
