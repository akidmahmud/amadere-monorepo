import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import {
  ProductGallery,
  ProductTabs,
  RatingStars,
  type ProductTab,
} from "@amader/ui";
import { AppLink } from "@/components/AppLink";
import { AppBreadcrumb } from "@/components/AppBreadcrumb";
import { PdpPurchasePanel } from "@/components/PdpPurchasePanel";
import { ProductFloatingBarProvider } from "@/components/ProductFloatingBarProvider";
import { WriteReviewForm } from "@/components/WriteReviewForm";
import { RelatedProductsCarousel } from "@/components/RelatedProductsCarousel";
import { CrossSellProductGrid } from "@/components/CrossSellProductGrid";
import { FrequentlyBoughtTogether } from "@/components/FrequentlyBoughtTogether";
import { getLanguageAlternates } from "@/i18n/alternates";
import { api, ApiError, safeGet } from "@/lib/api/client";
import { toApiLocale } from "@/lib/api-locale";
import type { components } from "@/lib/api/schema";
import { toDisplayImageUrl, toEmbeddableVideoUrl } from "@/lib/media";
import { toProductCardData } from "@/lib/product-card-mapper";
import { redirectIfMapped } from "@/lib/redirects";
import { sanitizeHtml } from "@/lib/sanitize-html";
import type { WhatsappConfig } from "@/lib/whatsapp";

// ISR per §7 — ISR + on-demand revalidation (src/app/api/revalidate) once the
// backend calls it on `product.updated` (see AGENTS.web.md §14 for what's
// still missing on that side).
export const revalidate = 3600;

type PublicProductDetailDto = components["schemas"]["PublicProductDetailDto"];

async function getProduct(slug: string, locale: "EN" | "BN", previewToken?: string) {
  try {
    const res = await api.GET("/api/v1/products/{slug}", {
      params: { path: { slug }, query: { locale, previewToken } },
    });
    return res.data as PublicProductDetailDto | undefined;
  } catch (err) {
    // See categories/[slug]/page.tsx's getCategory for why only a real
    // 404 is treated as not-found here, not any other kind of failure.
    if (err instanceof ApiError && err.status === 404) return undefined;
    throw err;
  }
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ previewToken?: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const { previewToken } = await searchParams;
  const product = await getProduct(slug, toApiLocale(locale), previewToken);
  if (!product) {
    await redirectIfMapped(`/products/${slug}`, locale);
    notFound();
  }

  const path = `/products/${slug}`;
  return {
    title: product.seo.title,
    description: product.seo.description ?? undefined,
    alternates: { canonical: path, languages: getLanguageAlternates(path) },
    openGraph: {
      title: product.seo.ogTitle,
      description: product.seo.ogDescription ?? undefined,
      images: product.seo.ogImageUrl ? [product.seo.ogImageUrl] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ previewToken?: string }>;
}) {
  const { locale, slug } = await params;
  const { previewToken } = await searchParams;
  setRequestLocale(locale);
  const localeParam = toApiLocale(locale);

  const product = await getProduct(slug, localeParam, previewToken);
  if (!product) {
    await redirectIfMapped(`/products/${slug}`, locale);
    notFound();
  }

  const category = product.categories[0];

  const [reviewsRes, relatedRes, whatsappRes] = await Promise.all([
    safeGet("/api/v1/products/{productId}/reviews", {
      params: { path: { productId: product.id }, query: { pageSize: 10 } },
    }),
    category
      ? safeGet("/api/v1/products", {
          params: { query: { locale: localeParam, categoryId: category.id, pageSize: 9 } },
        })
      : Promise.resolve({ data: undefined }),
    // Same config on every product page too — powers the WhatsApp order button.
    safeGet("/api/v1/whatsapp/config"),
  ]);

  const reviews = reviewsRes.data as components["schemas"]["ProductReviewsPageDto"] | undefined;
  const relatedProducts = ((relatedRes.data?.items ?? []) as components["schemas"]["PublicProductDto"][])
    .filter((p) => p.id !== product.id)
    .slice(0, 8)
    .map(toProductCardData);
  const crossSellProducts = product.crossSell.map(toProductCardData);

  const images = product.media
    .filter((m) => (m.type as unknown as string) !== "VIDEO")
    .map((m) => toDisplayImageUrl(m.url))
    .filter((url): url is string => Boolean(url))
    .map((url) => ({ url }));

  // "Key Benefits" tab — a checklist, unlike the deprecated badge strip.
  const benefitPoints = (product.benefitPoints ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  // Admin-authored WYSIWYG HTML, not user-generated — same trust level as
  // the description block above and blog post content elsewhere. Still
  // sanitized before render, so a compromised admin account can't plant a
  // stored-XSS payload that runs for every visitor.
  function htmlBlock(html: string) {
    // eslint-disable-next-line react/no-danger
    return <div className="rich-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />;
  }

  const tabs = [
    product.content && { id: "description", label: "Description", content: htmlBlock(product.content) },
    // Jump-link, not a content tab — clicking it scrolls down to the
    // Customer Reviews section (id="reviews") further down this same page
    // rather than switching the pane here. Placed right after Description
    // per explicit request. Always shown: the review form below renders
    // unconditionally even with zero reviews yet, so there's always
    // somewhere real to land.
    { id: "reviews", label: "Reviews", content: null, scrollTargetId: "reviews" },
    product.faqs.length > 0 && {
      id: "faq",
      label: "FAQ",
      content: (
        <div className="flex flex-col gap-4">
          {product.faqs.map((faq, i) => (
            <div key={i}>
              <p className="font-body text-sm font-bold text-text">{faq.question}</p>
              <p className="mt-1 font-body text-sm text-secondary">{faq.answer}</p>
            </div>
          ))}
        </div>
      ),
    },
    benefitPoints.length > 0 && {
      id: "key-benefits",
      label: "Key Benefits",
      content: (
        <ul className="flex flex-col gap-2.5">
          {benefitPoints.map((point, i) => (
            <li key={i} className="flex items-start gap-2.5 font-body text-sm font-medium text-text">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-green">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {point}
            </li>
          ))}
        </ul>
      ),
    },
    product.howToUse && { id: "how-to-use", label: "How to Use", content: htmlBlock(product.howToUse) },
  ].filter(Boolean) as ProductTab[];

  return (
    <ProductFloatingBarProvider product={product}>
    <main className="flex-1">
      {previewToken && (
        <div className="sticky top-0 z-50 bg-[#7c3aed] py-2 text-center font-ui text-xs font-bold text-white">
          Preview mode — this product is not published yet
        </div>
      )}
      {product.structuredData.map((item, i) => (
        // eslint-disable-next-line react/no-danger
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }} />
      ))}

      {/* 80% of viewport, not the site's usual fixed max-w-[1180px] (used
          elsewhere: checkout, blog, category/brand/tag listings, etc.) —
          ghorerbazar.com's own product-detail container is a fluid
          `max-width: 80%` with no fixed cap (confirmed via computed style),
          so a fixed pixel width here left a much wider margin than theirs on
          large screens. Scoped to this page only; the sitewide 1180px
          convention elsewhere is unchanged. */}
      <div className="mx-auto max-w-full px-0 sm:max-w-[80%] sm:px-5">
        <div className="pl-4 sm:pl-0">
          {/* Just Home + category, per explicit request — the full
              Home/Shop/Category/Product-name chain repeated the H1 right
              below it and wrapped to two lines on mobile. */}
          <AppBreadcrumb
            items={[
              { label: "Home", href: "/" },
              ...(category ? [{ label: category.name, href: `/categories/${category.slug}` }] : []),
            ]}
          />
        </div>

        {/* Card look matched to ghorerbazar.com's PDP hero card: no border,
            a tighter/darker shadow than this app's default shadow-brand
            token, 12px radius, 8px padding on mobile growing to 24px at
            sm+, a small ~2-4px mobile side margin (not truly flush — an
            earlier pass here assumed 0/flush on mobile, but re-measuring
            both black-seed-honey and gawa-ghee at a real 375px viewport
            shows the reference keeps a tiny inset + full radius + shadow
            even on mobile) — measured directly off that reference page
            rather than reusing @amader/ui's Card (its border+shadow-brand
            defaults don't match and can't be reliably overridden via plain
            string concatenation, since `cn` here is clsx without
            tailwind-merge). */}
        <div className="mx-1 mb-10 rounded-xl bg-white p-2 shadow-[0_2px_4px_rgba(0,0,0,0.11)] sm:mx-0 sm:p-6">
          <div className="grid grid-cols-2 items-start gap-5 max-lg:grid-cols-1 max-lg:gap-3">
            <ProductGallery images={images} videoUrl={toEmbeddableVideoUrl(product.videoUrl)} />

            {/* Info column (everything below the gallery) scaled down on
                mobile — the gallery/swiper image itself is deliberately
                outside this wrapper so it stays full size. `zoom` (not
                `transform: scale`) so the box actually shrinks instead of
                leaving reserved whitespace. Was 66.67%, bumped to 80% per
                explicit request ("content too small, make it a little
                bigger") — still smaller than full size, just less so. */}
            <div className="max-lg:[zoom:80%]">
              {category && (
                <div className="mb-1 font-ui text-sm font-semibold uppercase tracking-wide text-gold-dark">
                  {category.name}
                </div>
              )}
              {/* 18px/500 re-measured directly against the reference's mobile
                  product-single row (was 24px, too large there) — kept at
                  24px from md up, matching the reference's larger desktop
                  title. Bumped a step (18→20px) per explicit request once
                  the whole info column started rendering at 1.5x zoom-out. */}
              <h1 className="mb-3 font-ui text-xl font-medium tracking-[-0.6px] text-[#222831] md:mb-4 md:text-2xl">
                {product.name}
              </h1>
              {reviews && reviews.reviewCount > 0 && (
                <RatingStars rating={reviews.averageRating ?? 0} count={reviews.reviewCount} className="mb-3" />
              )}

              <PdpPurchasePanel product={product} whatsappConfig={(whatsappRes.data as WhatsappConfig | undefined) ?? null} />
            </div>
          </div>
        </div>



        <FrequentlyBoughtTogether mainProduct={product} items={product.frequentlyBoughtTogether} />

        {/* Unlike the hero card above (deliberately flush/edge-to-edge on
            mobile, matching the reference), the reference's tab-pane card
            keeps a real side gutter + rounded corners even on mobile
            (confirmed via computed style: hero ~2px inset vs tab-pane's
            ~12-16px) — so this one needs its own mx-4/sm:mx-0 instead of
            relying on the shared wrapper's mobile px-0. */}
        <div className="mx-4 rounded-lg bg-white p-6 shadow-[0_2px_4px_rgba(0,0,0,0.11)] sm:mx-0">
          <ProductTabs
            tabs={tabs}
            extraRight={
              product.brand ? (
                <AppLink
                  href={`/brands/${product.brand.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3.5 py-2 font-ui text-xs sm:text-sm font-medium text-[#222831] hover:border-green hover:text-green transition-colors shadow-2xs"
                >
                  <span className="text-muted">Brand:</span>
                  <span className="font-bold text-green">{product.brand.name}</span>
                </AppLink>
              ) : undefined
            }
          />
        </div>

        {/* Standalone section, not a tab — per explicit request. Same card
            treatment as the tabs card above (mobile gutter + rounded
            corners), positioned directly under it. */}
        {product.videoUrl && (
          <div className="mx-4 mt-10 rounded-lg bg-white p-6 shadow-[0_2px_4px_rgba(0,0,0,0.11)] sm:mx-0">
            <h2 className="mb-4 text-xl font-bold text-[#222831]">Product Video</h2>
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
              <iframe
                src={toEmbeddableVideoUrl(product.videoUrl) ?? undefined}
                title="Product video"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          </div>
        )}
      </div>

      {relatedProducts.length > 0 && (
        <div className="mx-auto max-w-full px-5 py-10 sm:max-w-[80%]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#222831]">Related Products</h2>
            {category && (
              <AppLink href={`/categories/${category.slug}`} className="text-sm font-medium text-green hover:underline">
                More Products →
              </AppLink>
            )}
          </div>
          {/* No arrows (swipe/autoplay only, per explicit request) and a
              slower autoplay. Card widths mirror Cross Sell Products' grid
              breakpoints exactly (2/3/5 columns) so both sections show the
              same card size — computed against this Carousel's own 18px gap
              (gap-4.5), not Cross Sell's 16px grid gap, so the math differs
              slightly even though the resulting column count matches.
              snap-start (paired with the Carousel's own snap-x snap-mandatory)
              is what actually guarantees exactly N full cards show at rest —
              without it, autoplay/swipes can stop at any scroll offset and
              show partial cards peeking on both edges. */}
          <RelatedProductsCarousel products={relatedProducts} />
        </div>
      )}

      {crossSellProducts.length > 0 && (
        <div className="mx-auto max-w-full px-5 py-10 sm:max-w-[80%]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#222831]">Cross Sell Products</h2>
            <AppLink href="/products" className="text-sm font-medium text-green hover:underline">
              More Products →
            </AppLink>
          </div>
          <CrossSellProductGrid products={crossSellProducts} />
        </div>
      )}

      {/* Target of the tab bar's "Reviews" jump-link (scrollTargetId="reviews"
          above) — scroll-margin so the sticky header (if any) doesn't cover
          the heading when the browser lands here. */}
      <div id="reviews" className="mx-auto max-w-full scroll-mt-20 px-5 py-10 sm:max-w-[80%]">
        <div className="rounded-none bg-white p-6 shadow-[0_2px_4px_rgba(0,0,0,0.11)] sm:rounded-lg">
          <h2 className="mb-4 text-xl font-bold text-[#222831]">Customer Reviews</h2>

          {reviews && (
            <div className="mb-8 grid gap-8 md:grid-cols-[auto_1fr]">
              <div>
                <div className="text-4xl font-bold text-[#222831]">{(reviews.averageRating ?? 0).toFixed(1)}</div>
                <RatingStars rating={reviews.averageRating ?? 0} />
                <p className="mt-1 text-sm text-muted">({reviews.reviewCount} Reviews)</p>
              </div>
              {/* Breakdown is computed from the currently-fetched review page
                  (up to `pageSize` items), not a true all-time aggregate — no
                  backend aggregate endpoint exists for this yet. Good enough for
                  the review volume this site sees today without adding one. */}
              <div className="flex flex-col justify-center gap-1.5">
                {[5, 4, 3, 2, 1].map((star) => {
                  const countAtStar = reviews.items.filter((r) => r.rating === star).length;
                  const pct = reviews.items.length > 0 ? Math.round((countAtStar / reviews.items.length) * 100) : 0;
                  return (
                    <div key={star} className="flex items-center gap-3 text-sm">
                      <span className="w-16 shrink-0 text-[#F48721]">{"★".repeat(star)}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#eee]">
                        <div className="h-full rounded-full bg-[#F48721]" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-10 shrink-0 text-right text-muted">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {reviews && reviews.items.length > 0 && (
            <div className="mb-8 space-y-4">
              {reviews.items.map((review) => (
                <div key={review.id} className="rounded-brand border border-line bg-white p-4">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="font-ui text-sm font-semibold text-ink">{review.customerName}</span>
                    <RatingStars rating={review.rating} />
                  </div>
                  {review.comment && <p className="font-body text-sm text-muted">{review.comment}</p>}
                  {review.images.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {review.images.map((url) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={url}
                          src={toDisplayImageUrl(url) ?? url}
                          alt=""
                          className="h-16 w-16 rounded-lg border border-line object-cover"
                        />
                      ))}
                    </div>
                  )}
                  {review.reply && (
                    <p className="mt-2 border-l-2 border-green pl-3 font-body text-xs text-muted">
                      <span className="font-semibold text-ink">Reply: </span>
                      {review.reply.message}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <WriteReviewForm productId={product.id} />
        </div>
      </div>
    </main>
    </ProductFloatingBarProvider>
  );
}
