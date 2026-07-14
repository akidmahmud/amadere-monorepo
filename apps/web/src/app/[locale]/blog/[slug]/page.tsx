import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { BlogCard, FaqAccordion, SectionHeading } from "@amader/ui";
import { AppBreadcrumb } from "@/components/AppBreadcrumb";
import { AppLink } from "@/components/AppLink";
import { getLanguageAlternates } from "@/i18n/alternates";
import { safeGet } from "@/lib/api/client";
import { toApiLocale } from "@/lib/api-locale";
import { toDisplayImageUrl } from "@/lib/media";
import { formatBlogDate, toBlogCardData } from "@/lib/blog-mapper";
import { redirectIfMapped } from "@/lib/redirects";
import type { components } from "@/lib/api/schema";

// ISR per §7 (on-demand revalidation still needs the backend side — §14).
export const revalidate = 3600;

type PublicBlogPostDetailDto = components["schemas"]["PublicBlogPostDetailDto"];

async function getPost(slug: string, locale: string) {
  const res = await safeGet("/api/v1/blog-posts/{slug}", {
    params: { path: { slug }, query: { locale } },
  });
  return res.data as PublicBlogPostDetailDto | undefined;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getPost(slug, toApiLocale(locale));
  if (!post) {
    // Not just future slug-rename hygiene: the old site's blog *category*
    // links were bare `/blog/{slug}` (same shape as this article route),
    // migrated to `/blog/category/{slug}` — this is the one real collision
    // point where an old URL lands on a route that already matches syntactically.
    await redirectIfMapped(`/blog/${slug}`, locale);
    notFound();
  }

  const path = `/blog/${slug}`;
  return {
    title: post.seo.title,
    description: post.seo.description ?? post.metaDescription ?? undefined,
    alternates: { canonical: path, languages: getLanguageAlternates(path) },
    openGraph: {
      title: post.seo.ogTitle,
      description: post.seo.ogDescription ?? undefined,
      images: post.seo.ogImageUrl ? [post.seo.ogImageUrl] : undefined,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const localeParam = toApiLocale(locale);

  const post = await getPost(slug, localeParam);
  if (!post) {
    await redirectIfMapped(`/blog/${slug}`, locale);
    notFound();
  }

  const category = post.categories[0];
  const authorName = [post.author.firstName, post.author.lastName].filter(Boolean).join(" ") || "আমাদের";

  return (
    <main className="flex-1">
      {post.structuredData.map((item, i) => (
        // eslint-disable-next-line react/no-danger
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }} />
      ))}

      <div className="mx-auto max-w-[1180px] px-5">
        <AppBreadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Blog", href: "/blog" },
            ...(category ? [{ label: category.name, href: `/blog/category/${category.slug}` }] : []),
            { label: post.title },
          ]}
        />

        <div className="grid grid-cols-[1fr_260px] gap-11 pb-14 max-lg:grid-cols-1">
          <article>
            <h1 className="mb-3 font-serif text-3xl font-semibold text-ink">{post.title}</h1>
            <p className="mb-5 font-body text-sm text-muted">
              By{" "}
              <AppLink href={`/blog/author/${post.author.id}`} className="text-green">
                {authorName}
              </AppLink>
              {post.publishedAt && ` · ${formatBlogDate(post.publishedAt)}`}
            </p>

            {toDisplayImageUrl(post.imageUrl) && (
              <img
                src={toDisplayImageUrl(post.imageUrl)}
                alt={post.title}
                className="mb-6 aspect-[16/9] w-full rounded-brand object-cover"
              />
            )}

            {/* Admin-authored WYSIWYG HTML, not user-generated — safe per backend's own content.util.ts docs */}
            {/* eslint-disable-next-line react/no-danger */}
            <div
              className="prose max-w-none font-body text-sm leading-relaxed text-ink [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-serif [&_h3]:text-lg [&_h3]:font-semibold [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:text-green [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />

            {post.tags.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <AppLink
                    key={tag.slug}
                    href={`/blog/tag/${tag.slug}`}
                    className="rounded-full bg-beige px-3 py-1 font-ui text-xs text-ink"
                  >
                    #{tag.name}
                  </AppLink>
                ))}
              </div>
            )}

            {post.faqs.length > 0 && (
              <div className="mt-10">
                <h2 className="mb-4 font-serif text-xl font-semibold text-ink">Frequently Asked Questions</h2>
                <FaqAccordion items={post.faqs} />
              </div>
            )}
          </article>

          {post.toc.length > 0 && (
            <aside className="max-lg:hidden">
              <div className="sticky top-[100px] rounded-brand border border-line bg-white p-4">
                <p className="mb-3 font-ui text-xs font-semibold uppercase tracking-wide text-muted">
                  On this page
                </p>
                <nav className="space-y-2">
                  {post.toc.map((entry) => (
                    <a
                      key={entry.anchor}
                      href={`#${entry.anchor}`}
                      className={`block font-body text-sm text-ink hover:text-green ${entry.level === 3 ? "pl-3" : ""}`}
                    >
                      {entry.text}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>
          )}
        </div>
      </div>

      {post.relatedPosts.length > 0 && (
        <div className="mx-auto max-w-[1180px] px-5 py-9">
          <SectionHeading>Related Posts</SectionHeading>
          <div className="grid grid-cols-3 gap-5 max-lg:grid-cols-2 max-sm:grid-cols-1">
            {post.relatedPosts.map((related) => (
              <BlogCard key={related.id} post={toBlogCardData(related)} linkComponent={AppLink} />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
