import type { Metadata } from "next";
import { generateProductMetadata, ProductDetailBody } from "../../product-detail";

// Admin-only, linked from ProductPreviewButton.tsx — reads the token from a
// path segment instead of `?previewToken=`, specifically so the real
// `/products/[slug]` route never has to touch `searchParams` and can stay
// statically rendered + ISR'd (see PERF-BRIEF.md §3 and the comment on that
// route). `force-dynamic` because a preview token is single-purpose and
// tied to whatever draft state the admin is currently looking at — it
// should never be served from a cache, and there's no reason to spend ISR
// cache slots on disposable per-edit preview URLs.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string; token: string }>;
}): Promise<Metadata> {
  const { locale, slug, token } = await params;
  return generateProductMetadata(slug, locale, token);
}

export default async function ProductPreviewPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; token: string }>;
}) {
  const { locale, slug, token } = await params;
  return <ProductDetailBody slug={slug} locale={locale} previewToken={token} />;
}
