import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  ProductTabs,
  RatingStars,
  type ProductTab,
} from "@amader/ui";
import { PdpGallery } from "@/components/PdpGallery";
import { SelectedVariantProvider } from "@/components/SelectedVariantProvider";
import { AppLink } from "@/components/AppLink";
import { AppBreadcrumb } from "@/components/AppBreadcrumb";
import { DigitalPreviewButton } from "@/components/DigitalPreviewButton";
import { BookAuthorPanel, BookSpecificationPanel } from "@/components/BookTabPanels";
import { FaqAccordion } from "@/components/FaqAccordion";
import { PdpPurchasePanel } from "@/components/PdpPurchasePanel";
import { ProductFloatingBarProvider } from "@/components/ProductFloatingBarProvider";
import { ReviewsCarousel } from "@/components/ReviewsCarousel";

// First page rendered server-side; the rest load on demand.
const REVIEWS_PAGE_SIZE = 10;
import { WriteReviewForm } from "@/components/WriteReviewForm";
import { RelatedProductsCarousel } from "@/components/RelatedProductsCarousel";
import { CrossSellProductGrid } from "@/components/CrossSellProductGrid";
import { FrequentlyBoughtTogether } from "@/components/FrequentlyBoughtTogether";
import { getLanguageAlternates } from "@/i18n/alternates";
import { api, ApiError, safeGet } from "@/lib/api/client";
import { toApiLocale } from "@/lib/api-locale";
import type { components } from "@/lib/api/schema";
import { toDisplayImageUrl, toEmbeddableVideoUrl } from "@/lib/media";
import { defaultVariantId } from "@/lib/pdp";
import { toProductCardData } from "@/lib/product-card-mapper";
import { redirectIfMapped } from "@/lib/redirects";
import { sanitizeHtml } from "@/lib/sanitize-html";
import type { WhatsappConfig } from "@/lib/whatsapp";

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

// Shared by the real (static/ISR) product route and the admin-only preview
// route (see ./preview/[token]/page.tsx) — factored out so ONLY the preview
// route reads a token at all. Previously both generateMetadata and the page
// itself read `searchParams.previewToken` directly, which opts the whole
// route into fully dynamic (uncached) rendering in the App Router — see
// PERF-BRIEF.md §3. That silently overrode this page's own `revalidate =
// 3600`, meaning every single ad-click landed on a cold, uncached SSR pass
// (nine backend calls) instead of a cached response. `previewToken` is now
// never read from this route's own searchParams — it's either absent (the
// real route) or comes from a path segment (the preview route), neither of
// which trips that opt-out.
export async function generateProductMetadata(
  slug: string,
  locale: string,
  previewToken: string | undefined,
): Promise<Metadata> {
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

export async function ProductDetailBody({
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
  const tRelated = await getTranslations("relatedProducts");
  const tBook = await getTranslations("bookTabs");

  const product = await getProduct(slug, localeParam, previewToken);
  if (!product) {
    await redirectIfMapped(`/products/${slug}`, locale);
    notFound();
  }

  const category = product.categories[0];
  // The generated OpenAPI types model backend enums as opaque objects
  // (see the media `type` filter below for the same cast).
  const isDigital = (product.productType as unknown as string) === "DIGITAL";

  const [reviewsRes, relatedRes, whatsappRes] = await Promise.all([
    safeGet("/api/v1/products/{productId}/reviews", {
      // First page only. The rest load on demand via the "Load more"
      // button in ReviewsCarousel, so a product with hundreds of reviews
      // does not push all of them into the initial HTML.
      params: { path: { productId: product.id }, query: { pageSize: REVIEWS_PAGE_SIZE } },
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
  // Admin-picked list wins outright when it has anything in it, in the exact
  // order the admin dragged (ProductRelation.position). The automatic
  // same-category query below is the FALLBACK, unchanged from before this
  // feature — so a product nobody has curated behaves exactly as it always
  // did, and only a curated one gets the new heading.
  const manualRelated = (product.relatedProducts ?? []).map(toProductCardData);
  const autoRelated = ((relatedRes.data?.items ?? []) as components["schemas"]["PublicProductDto"][])
    .filter((p) => p.id !== product.id)
    .slice(0, 8)
    .map(toProductCardData);
  const hasManualRelated = manualRelated.length > 0;
  const relatedProducts = hasManualRelated ? manualRelated : autoRelated;
  const crossSellProducts = product.crossSell.map(toProductCardData);

  // variantId rides along so PdpGallery can jump to a variant's own image
  // when it's selected (null = shared image, used for every variant).
  const images = product.media
    .filter((m) => (m.type as unknown as string) !== "VIDEO")
    .map((m) => ({ url: toDisplayImageUrl(m.url), variantId: m.variantId }))
    .filter((img): img is { url: string; variantId: number | null } => Boolean(img.url));

  // Admin-authored WYSIWYG HTML, not user-generated — same trust level as
  // the description block above and blog post content elsewhere. Still
  // sanitized before render, so a compromised admin account can't plant a
  // stored-XSS payload that runs for every visitor.
  function htmlBlock(html: string) {
    // eslint-disable-next-line react/no-danger
    return <div className="rich-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />;
  }

  // A DIGITAL product is a book, and its page should read like one: Summary,
  // Specification, Author — not the physical catalogue's Description / How to
  // Use / Key Benefits / Why Choose Us. Summary is a RELABEL of the existing
  // long-form content field, not a new column, so an ebook written before
  // this feature keeps whatever the admin already typed.
  //
  // Reviews stays in both sets: it is a jump-link to the review section this
  // same page always renders, and a book has reviews like anything else.
  const bookTabs = [
    product.content && { id: "summary", label: tBook("summary"), content: htmlBlock(product.content) },
    { id: "specification", label: tBook("specification"), content: <BookSpecificationPanel product={product} /> },
    product.author && { id: "author", label: tBook("author"), content: <BookAuthorPanel author={product.author} /> },
    { id: "reviews", label: "Reviews", content: null, scrollTargetId: "reviews" },
    product.faqs.length > 0 && {
      id: "faq",
      label: "FAQ",
      content: <FaqAccordion faqs={product.faqs} />,
    },
  ].filter(Boolean) as ProductTab[];

  const physicalTabs = [
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
      content: <FaqAccordion faqs={product.faqs} />,
    },
    // Both fields are now real CKEditor HTML (headings, bulleted lists,
    // paragraphs) instead of loose plain text — the admin builds the actual
    // structure themselves with the editor's own tools, so this just renders
    // it like Description/Brand below, no text-convention parsing and no
    // auto-generated checkmark styling (tried a CSS checkmark-bullet look
    // here briefly; removed per explicit request — plain rich-content
    // bullets like every other tab, admin can type their own ✓/bullet
    // characters directly if they want that look on a specific product).
    product.benefitPoints && { id: "key-benefits", label: "Key Benefits", content: htmlBlock(product.benefitPoints) },
    product.howToUse && { id: "how-to-use", label: "How to Use", content: htmlBlock(product.howToUse) },
    // Always last, per explicit request — kept as its own array push (not
    // spliced in above) so it can never end up anywhere but the final tab
    // regardless of which of the other conditional tabs are present.
    product.brand && {
      id: "brand",
      label: "Brand",
      content: product.brand.description
        ? htmlBlock(product.brand.description)
        : <p className="font-body text-sm text-secondary">No description available for {product.brand.name} yet.</p>,
    },
  ].filter(Boolean) as ProductTab[];

  const tabs = isDigital ? bookTabs : physicalTabs;

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
          {/* Wraps BOTH the gallery and the purchase panel so picking a
              variant in one can move the other — they're siblings in this
              grid and have no other shared state. */}
          <SelectedVariantProvider initialVariantId={product.hasVariants ? defaultVariantId(product) : undefined}>
          <div className="grid grid-cols-2 items-start gap-5 max-lg:grid-cols-1 max-lg:gap-3">
            {/* `relative` only so a DIGITAL product's "আরও পড়ুন"
                call-out can sit over the image — DigitalPreviewButton
                renders nothing at all for a PHYSICAL product, which is why
                the gallery itself needs no branching. */}
            <div className="relative">
              <PdpGallery images={images} videoUrl={toEmbeddableVideoUrl(product.videoUrl)} />
              {isDigital && <DigitalPreviewButton product={product} />}
            </div>

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
              {/* Short description under the title — DIGITAL only, per
                  explicit request. This is ProductTranslation.description
                  (the admin's "Short Description"), which the PDP did not
                  render ANYWHERE before this: it only fed SEO metadata and
                  the Product JSON-LD, so there is no second copy further
                  down the page to suppress. Physical products are untouched.

                  Clamped to 3 lines, and kept visually secondary (text-sm,
                  muted). The clamp is what keeps the price and the CTA above
                  the fold at 390px — a blurb long enough to matter would
                  otherwise push both down; the full text lives one tap away
                  in the Summary tab. */}
              {isDigital && product.description && (
                <div
                  className="mb-3 line-clamp-3 font-body text-sm leading-relaxed text-muted [&_p]:m-0"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description) }}
                />
              )}
              {reviews && reviews.reviewCount > 0 && (
                <RatingStars rating={reviews.averageRating ?? 0} count={reviews.reviewCount} className="mb-3" />
              )}

              <PdpPurchasePanel product={product} whatsappConfig={(whatsappRes.data as WhatsappConfig | undefined) ?? null} />
            </div>
          </div>
          </SelectedVariantProvider>
        </div>



        <FrequentlyBoughtTogether mainProduct={product} items={product.frequentlyBoughtTogether} />

        {/* Unlike the hero card above (deliberately flush/edge-to-edge on
            mobile, matching the reference), the reference's tab-pane card
            keeps a real side gutter + rounded corners even on mobile
            (confirmed via computed style: hero ~2px inset vs tab-pane's
            ~12-16px) — so this one needs its own mx-4/sm:mx-0 instead of
            relying on the shared wrapper's mobile px-0. */}
        <div className="mx-4 rounded-lg bg-white p-6 shadow-[0_2px_4px_rgba(0,0,0,0.11)] sm:mx-0">
          <ProductTabs tabs={tabs} />
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

      {/* Reviews sit ABOVE Related/Cross Sell per explicit request — social
          proof for the product the visitor actually came for, before we
          start pointing them at other products. Also the target of the tab
          bar's "Reviews" jump-link (scrollTargetId="reviews" above) —
          scroll-margin so the sticky header doesn't cover the heading when
          the browser lands here. */}
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
              {/* Percentages come from `ratingBreakdown`, a groupBy over every
                  approved review on the backend. They used to be derived from
                  whatever the first page happened to contain, which made them a
                  sample of `pageSize` rather than the real distribution. */}
              <div className="flex flex-col justify-center gap-1.5">
                {[5, 4, 3, 2, 1].map((star) => {
                  const countAtStar = reviews.ratingBreakdown?.find((b) => b.rating === star)?.count ?? 0;
                  const pct = reviews.reviewCount > 0 ? Math.round((countAtStar / reviews.reviewCount) * 100) : 0;
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
            <ReviewsCarousel
              productId={product.id}
              initialCount={reviews.items.length}
              total={reviews.reviewCount}
              pageSize={REVIEWS_PAGE_SIZE}
            >
              {reviews.items.map((review) => (
                <div
                  key={review.id}
                  // Full width and non-shrinking below sm so exactly one card
                  // fills the viewport per snap position; auto width above it,
                  // where the parent is a plain column again.
                  className="w-full shrink-0 snap-center rounded-brand border border-line bg-white p-4 sm:w-auto sm:shrink"
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="font-ui text-sm font-semibold text-ink">{review.customerName}</span>
                    <RatingStars rating={review.rating} />
                  </div>
                  {review.comment && <p className="font-body text-sm text-muted">{review.comment}</p>}
                  {review.images.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {review.images.map((url) => (
                        <Image
                          key={url}
                          src={toDisplayImageUrl(url) ?? url}
                          alt=""
                          width={64}
                          height={64}
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
            </ReviewsCarousel>
          )}

          <WriteReviewForm productId={product.id} />
        </div>
      </div>

      {relatedProducts.length > 0 && (
        <div className="mx-auto max-w-full px-5 py-10 sm:max-w-[80%]">
          <div className="mb-4 flex items-center justify-between gap-3">
            {/* Two headings, not one: a manually curated list is the section
                the owner asked for by name ("আমাদের শপে আরও দেখতে পারেন"),
                while an uncurated product keeps the automatic section's
                original wording so nothing changes for it. Both come from
                next-intl, so neither locale ever renders the other's text. */}
            <h2 className="text-lg font-bold text-[#222831] sm:text-xl">
              {hasManualRelated ? tRelated("manualHeading") : tRelated("autoHeading")}
            </h2>
            {/* The "browse the category" escape hatch only makes sense for
                the category-derived list; a hand-picked one isn't a category. */}
            {!hasManualRelated && category && (
              <AppLink href={`/categories/${category.slug}`} className="shrink-0 text-sm font-medium text-green hover:underline">
                {tRelated("moreProducts")} →
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
    </main>
    </ProductFloatingBarProvider>
  );
}
