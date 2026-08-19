import type { Metadata } from "next";
import { generateProductMetadata, ProductDetailBody } from "./product-detail";

// ISR per §7 — ISR + on-demand revalidation (src/app/api/revalidate) once the
// backend calls it on `product.updated` (see AGENTS.web.md §14 for what's
// still missing on that side).
//
// This route must NEVER read `searchParams` (see PERF-BRIEF.md §3) — doing
// so silently opts the whole route into dynamic (uncached) rendering and
// overrides `revalidate` above, which is exactly what was happening before:
// every ad click was a cold 9-backend-call SSR instead of a cached hit.
// Preview mode lives entirely at ./preview/[token]/page.tsx now, which reads
// its token from a path segment instead.
export const revalidate = 3600;

// Deliberately empty — see the note below before changing this.
//
// Exporting generateStaticParams AT ALL is what makes Next treat this
// segment as ISR-eligible-on-first-hit rather than fully dynamic (an
// undocumented-feeling but load-bearing detail — without the export,
// `revalidate` above is silently ignored). `dynamicParams` defaults to
// true, so any slug renders on demand and is then cached.
//
// ⚠️ Returning the real slug list here DOES fix the "footer paints before
// the product" streaming order (an on-demand render must await its data, so
// React emits the layout shell first and defers <main> into a trailing
// `<div hidden>`; a build-time prerender resolves everything up front and
// emits <main> in document order — confirmed by byte offset against the
// homepage, which is build-prerendered and has never had the problem).
//
// It was tried and reverted: prerendering all ~77 products × 2 locales
// fires ~600 backend calls during `next build`, and `getProduct` rethrows
// anything that isn't a 404, so a single transient blip aborts the whole
// build — i.e. a failed deploy. That risk is not worth it on a box that
// builds while also serving live traffic. Re-attempt only alongside: a
// resilient fetch path for the build, a throttler exemption for
// server-side build traffic, and ideally a bounded slug list.
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  return generateProductMetadata(slug, locale, undefined);
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  return <ProductDetailBody slug={slug} locale={locale} previewToken={undefined} />;
}
