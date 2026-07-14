import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getLanguageAlternates } from "@/i18n/alternates";
import { safeGet } from "@/lib/api/client";
import { toApiLocale } from "@/lib/api-locale";
import { BlogListing } from "@/components/BlogListing";
import { redirectIfMapped } from "@/lib/redirects";
import type { components } from "@/lib/api/schema";

// ISR per §7 (on-demand revalidation still needs the backend side — §14).
export const revalidate = 3600;

const PAGE_SIZE = 12;

async function getTag(slug: string, locale: string) {
  const res = await safeGet("/api/v1/blog-tags/{slug}", {
    params: { path: { slug }, query: { locale } },
  });
  return res.data as components["schemas"]["PublicBlogTagDto"] | undefined;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const tag = await getTag(slug, toApiLocale(locale));
  if (!tag) {
    await redirectIfMapped(`/blog/tag/${slug}`, locale);
    notFound();
  }

  const path = `/blog/tag/${slug}`;
  return {
    title: `#${tag.name}`,
    alternates: { canonical: path, languages: getLanguageAlternates(path) },
  };
}

export default async function BlogTagPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const localeParam = toApiLocale(locale);
  const page = Math.max(1, Number((await searchParams).page) || 1);

  const tag = await getTag(slug, localeParam);
  if (!tag) {
    await redirectIfMapped(`/blog/tag/${slug}`, locale);
    notFound();
  }

  const res = await safeGet("/api/v1/blog-posts", {
    params: { query: { locale: localeParam, page, pageSize: PAGE_SIZE, tag: slug } },
  });

  return (
    <main className="flex-1">
      <BlogListing
        posts={res.data?.items ?? []}
        total={res.data?.total ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        basePath={`/blog/tag/${slug}`}
        heading={`#${tag.name}`}
      />
    </main>
  );
}
