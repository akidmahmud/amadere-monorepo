import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getLanguageAlternates } from "@/i18n/alternates";
import { toApiLocale } from "@/lib/api-locale";
import { safeGet } from "@/lib/api/client";
import { toDisplayImageUrl } from "@/lib/media";
import { BlogListing } from "@/components/BlogListing";

// ISR per §7 (on-demand revalidation still needs the backend side — §14).
export const revalidate = 3600;

async function getAuthor(id: number, locale: string, page: number) {
  const res = await safeGet("/api/v1/blog-authors/{id}", {
    params: { path: { id }, query: { locale, page, pageSize: 12 } },
  });
  return res.data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const authorId = Number(id);
  if (!Number.isInteger(authorId)) notFound();

  const data = await getAuthor(authorId, toApiLocale(locale), 1);
  if (!data) notFound();

  const authorName = [data.author.firstName, data.author.lastName].filter(Boolean).join(" ") || "আমাদের";
  const path = `/blog/author/${id}`;
  return {
    title: authorName,
    alternates: { canonical: path, languages: getLanguageAlternates(path) },
  };
}

export default async function BlogAuthorPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const localeParam = toApiLocale(locale);
  const page = Math.max(1, Number((await searchParams).page) || 1);

  const authorId = Number(id);
  if (!Number.isInteger(authorId)) notFound();

  const data = await getAuthor(authorId, localeParam, page);
  if (!data) notFound();

  const { author, posts } = data;
  const authorName = [author.firstName, author.lastName].filter(Boolean).join(" ") || "আমাদের";

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-[1180px] px-5 pt-9">
        <div className="mb-6 flex items-center justify-center gap-4">
          <div className="h-16 w-16 overflow-hidden rounded-full bg-beige">
            {toDisplayImageUrl(author.avatarUrl) && (
              <img src={toDisplayImageUrl(author.avatarUrl)} alt={authorName} className="h-full w-full object-cover" />
            )}
          </div>
          <div>
            <h1 className="font-serif text-xl font-semibold text-ink">{authorName}</h1>
            <p className="font-body text-sm text-muted">{posts.total} article{posts.total === 1 ? "" : "s"}</p>
          </div>
        </div>
      </div>

      <BlogListing
        posts={posts.items}
        total={posts.total}
        page={posts.page}
        pageSize={posts.pageSize}
        basePath={`/blog/author/${id}`}
      />
    </main>
  );
}
