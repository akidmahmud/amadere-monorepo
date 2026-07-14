import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getLanguageAlternates } from "@/i18n/alternates";
import { safeGet } from "@/lib/api/client";
import { toApiLocale } from "@/lib/api-locale";
import { BlogListing } from "@/components/BlogListing";

// ISR per §7 (on-demand revalidation still needs the backend side — §14).
export const revalidate = 3600;

const PAGE_SIZE = 12;

export function generateMetadata(): Metadata {
  return {
    title: "Blog",
    alternates: { canonical: "/blog", languages: getLanguageAlternates("/blog") },
  };
}

export default async function BlogListPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const localeParam = toApiLocale(locale);
  const page = Math.max(1, Number((await searchParams).page) || 1);

  const res = await safeGet("/api/v1/blog-posts", {
    params: { query: { locale: localeParam, page, pageSize: PAGE_SIZE } },
  });

  return (
    <main className="flex-1">
      <BlogListing
        posts={res.data?.items ?? []}
        total={res.data?.total ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        basePath="/blog"
        heading="Our Blog"
      />
    </main>
  );
}
