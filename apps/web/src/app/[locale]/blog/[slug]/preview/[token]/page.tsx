import type { Metadata } from "next";
import { generatePostMetadata, PostDetailBody } from "../../post-detail";

// Admin-only, linked from BlogPreviewButton.tsx — reads the token from a
// path segment instead of `?previewToken=`, specifically so the real
// `/blog/[slug]` route never has to touch `searchParams` and can stay
// statically rendered + ISR'd (see PERF-BRIEF.md §3 and the comment on that
// route). `force-dynamic` because a preview token is single-purpose and
// tied to whatever draft state the admin is currently looking at — it
// should never be served from a cache.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string; token: string }>;
}): Promise<Metadata> {
  const { locale, slug, token } = await params;
  return generatePostMetadata(slug, locale, token);
}

export default async function BlogPostPreviewPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; token: string }>;
}) {
  const { locale, slug, token } = await params;
  return <PostDetailBody slug={slug} locale={locale} previewToken={token} />;
}
