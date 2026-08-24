import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { BlogCard, FaqAccordion, SectionHeading } from "@amader/ui";
import { AppBreadcrumb } from "@/components/AppBreadcrumb";
import { AppLink } from "@/components/AppLink";
import { BlogViewTracker } from "@/components/BlogViewTracker";
import { getLanguageAlternates } from "@/i18n/alternates";
import { api, ApiError } from "@/lib/api/client";
import { toApiLocale } from "@/lib/api-locale";
import { toDisplayImageUrl, IMG } from "@/lib/media";
import { formatBlogDate, toBlogCardData } from "@/lib/blog-mapper";
import { redirectIfMapped } from "@/lib/redirects";
import { sanitizeHtml } from "@/lib/sanitize-html";
import type { components } from "@/lib/api/schema";

type PublicBlogPostDetailDto = components["schemas"]["PublicBlogPostDetailDto"];

async function getPost(slug: string, locale: "EN" | "BN", previewToken?: string) {
  try {
    const res = await api.GET("/api/v1/blog-posts/{slug}", {
      params: { path: { slug }, query: { locale, previewToken } },
    });
    return res.data as PublicBlogPostDetailDto | undefined;
  } catch (err) {
    // See categories/[slug]/page.tsx's getCategory for why only a real
    // 404 is treated as not-found here, not any other kind of failure.
    if (err instanceof ApiError && err.status === 404) return undefined;
    throw err;
  }
}

// Shared by the real (static/ISR) post route and the admin-only preview
// route (see ./preview/[token]/page.tsx) — same split as
// products/[slug]/product-detail.tsx, for the same reason: reading
// `searchParams.previewToken` here would silently force this whole route
// into dynamic (uncached) rendering (PERF-BRIEF.md §3).
export async function generatePostMetadata(
  slug: string,
  locale: string,
  previewToken: string | undefined,
): Promise<Metadata> {
  const post = await getPost(slug, toApiLocale(locale), previewToken);
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

export async function PostDetailBody({
  slug,
  locale,
  previewToken,
}: {
  slug: string;
  locale: string;
  previewToken: string | undefined;
}) {
  setRequestLocale(locale);
  const localeParam = toApiLocale(locale);

  const post = await getPost(slug, localeParam, previewToken);
  if (!post) {
    await redirectIfMapped(`/blog/${slug}`, locale);
    notFound();
  }

  const category = post.categories[0];
  const authorName = [post.author.firstName, post.author.lastName].filter(Boolean).join(" ") || "আমাদের";

  return (
    <main className="flex-1">
      {/* Previewing a draft/unpublished revision shouldn't inflate real
          view-count analytics — same rule the backend itself already
          enforces (recordView no-ops on a non-PUBLISHED post), skipped
          here too so a preview link never even fires the beacon. */}
      {!previewToken && <BlogViewTracker postId={post.id} slug={post.slug} />}
      {previewToken && (
        <div className="sticky top-0 z-50 bg-[#7c3aed] py-2 text-center font-ui text-xs font-bold text-white">
          Preview mode — this post is not published yet
        </div>
      )}
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

            {toDisplayImageUrl(post.coverImageUrl, IMG.banner) && (
              // post.coverImageUrl is already resolved server-side to fall
              // back to the small thumbnail (imageUrl) when the admin never
              // set a dedicated 1600x500 cover — see
              // blog-posts.service.ts#publicGetBySlug. Was a fixed
              // aspect-[16/9] box with object-contain — stopped the
              // cropping, but forcing every real image (the thumbnail
              // fallback is mostly square, some — like a multi-panel
              // Word-pasted collage — much narrower/taller than 16:9) into
              // one fixed wide shape just traded cropping for huge empty
              // color bars on the narrow ones. No grid/carousel here needs
              // every post's image to be the same shape (unlike the blog
              // card grid, which does) — so just let each image size itself
              // at its own natural aspect ratio, capped so an extreme one
              // can't dominate the page.
              <img
                src={toDisplayImageUrl(post.coverImageUrl, IMG.banner)}
                alt={post.title}
                className="mx-auto mb-6 block max-h-[500px] max-w-full rounded-brand"
              />
            )}

            {/* Admin-authored WYSIWYG HTML, not user-generated — still sanitized before render */}
            {/* eslint-disable-next-line react/no-danger */}
            <div
              className="rich-content max-w-none font-body text-sm leading-relaxed text-ink [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-serif [&_h3]:text-lg [&_h3]:font-semibold [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:text-green [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
            />

            {/* Labels, not links — per explicit request tags no longer get
                their own browsable page. They still drive what shows up in
                Related Posts (findRelatedPosts matches on shared tags), so
                they're still doing real work, just not as navigation. */}
            {post.tags.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span
                    key={tag.slug}
                    className="rounded-full bg-beige px-3 py-1 font-ui text-xs text-ink"
                  >
                    #{tag.name}
                  </span>
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

          {(post.toc.length > 0 || post.relatedPosts.length > 0) && (
            <aside className="max-lg:hidden">
              <div className="sticky top-[100px] space-y-6">
                {post.toc.length > 0 && (
                  <div className="rounded-brand border border-line bg-white p-4">
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
                )}

                {/* Desktop-only: same related posts as the mobile block
                    below (lg:hidden there), just placed in this sidebar
                    column instead of full-width beneath the article. */}
                {post.relatedPosts.length > 0 && (
                  <div>
                    <p className="mb-3 font-ui text-xs font-semibold uppercase tracking-wide text-muted">
                      Related Posts
                    </p>
                    <div className="space-y-4">
                      {post.relatedPosts.map((related) => (
                        <BlogCard key={related.id} post={toBlogCardData(related)} linkComponent={AppLink} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>

      {post.relatedPosts.length > 0 && (
        <div className="mx-auto max-w-[1180px] px-5 py-9 lg:hidden">
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
