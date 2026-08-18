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

// Deliberately empty — no product slugs are pre-rendered at build time (that
// would make every deploy re-fetch every product), but exporting this at
// all is what makes Next.js treat the segment as ISR-eligible-on-first-hit
// rather than fully dynamic. `dynamicParams` defaults to true, so any slug
// not in this list is still rendered on demand and then cached per
// `revalidate` above.
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
