import type { Metadata } from "next";
import { generatePostMetadata, PostDetailBody } from "./post-detail";

// ISR per §7 (on-demand revalidation still needs the backend side — §14).
//
// This route must NEVER read `searchParams` (see PERF-BRIEF.md §3) — doing
// so silently opts the whole route into dynamic (uncached) rendering and
// overrides `revalidate` above. Preview mode lives entirely at
// ./preview/[token]/page.tsx now, which reads its token from a path segment
// instead.
export const revalidate = 3600;

// Deliberately empty — no post slugs are pre-rendered at build time, but
// exporting this at all is what makes Next.js treat the segment as
// ISR-eligible-on-first-hit rather than fully dynamic (confirmed live —
// without this export, the route stayed `no-store` even with `revalidate`
// set and no searchParams read at all). `dynamicParams` defaults to true,
// so any slug not in this list is still rendered on demand and cached per
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
  return generatePostMetadata(slug, locale, undefined);
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  return <PostDetailBody slug={slug} locale={locale} previewToken={undefined} />;
}
