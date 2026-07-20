import type { Metadata } from "next";
import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import {
  ProductGallery,
  ProductTabs,
  ProductCarouselSection,
  RatingStars,
  SectionHeading,
  WatchingNowBadge,
  MarketingReviewSection,
  ProductInfoVisual,
  ComparisonSection,
} from "@amader/ui";
import { AppLink } from "@/components/AppLink";
import { AppBreadcrumb } from "@/components/AppBreadcrumb";
import { PdpPurchasePanel } from "@/components/PdpPurchasePanel";
import { WriteReviewForm } from "@/components/WriteReviewForm";
import { ProductCarouselSectionClient } from "@/components/ProductCarouselSectionClient";
import { getLanguageAlternates } from "@/i18n/alternates";
import { safeGet } from "@/lib/api/client";
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
type PublicBundleDto = components["schemas"]["PublicBundleDto"];

// Same wavy-scene background as Footer's bottom art — designed to be
// revealed by giving the section enough height, not cropped down thin.
const MARKETING_REVIEW_BG_URL =
  "https://pub-51174804638049198acba5bbf211435e.r2.dev/image/caedc06c-8f36-4a7e-96e6-cc3a5cc838cb-marketing-review-bg.png";

async function getProduct(slug: string, locale: string) {
  const res = await safeGet("/api/v1/products/{slug}", {
    params: { path: { slug }, query: { locale } },
  });
  return res.data as PublicProductDetailDto | undefined;
}

function toBundleCardData(bundle: PublicBundleDto) {
  return { href: `/combos/${bundle.slug}`, name: bundle.name, price: bundle.bundlePrice ?? "0" };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const product = await getProduct(slug, toApiLocale(locale));
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
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const localeParam = toApiLocale(locale);

  const product = await getProduct(slug, localeParam);
  if (!product) {
    await redirectIfMapped(`/products/${slug}`, locale);
    notFound();
  }

  const category = product.categories[0];

  const [reviewsRes, relatedRes, combosRes, marketingReviewRes, whatsappRes] = await Promise.all([
    safeGet("/api/v1/products/{productId}/reviews", {
      params: { path: { productId: product.id }, query: { pageSize: 10 } },
    }),
    category
      ? safeGet("/api/v1/products", {
          params: { query: { locale: localeParam, categoryId: category.id, pageSize: 9 } },
        })
      : Promise.resolve({ data: undefined }),
    safeGet("/api/v1/product-bundles", {
      params: { query: { locale: localeParam, productId: product.id, pageSize: 8 } },
    }),
    // Same cards on every product page — not product-specific.
    safeGet("/api/v1/marketing-review-cards", { params: { query: { locale: localeParam } } }),
    // Same config on every product page too — powers the WhatsApp order button.
    safeGet("/api/v1/whatsapp/config"),
  ]);

  const reviews = reviewsRes.data as components["schemas"]["ProductReviewsPageDto"] | undefined;
  const relatedProducts = ((relatedRes.data?.items ?? []) as components["schemas"]["PublicProductDto"][])
    .filter((p) => p.id !== product.id)
    .slice(0, 8)
    .map(toProductCardData);
  const combos = (combosRes.data?.items ?? []).map(toBundleCardData);
  const marketingReviewCards = (
    (marketingReviewRes.data ?? []) as components["schemas"]["PublicMarketingReviewCardDto"][]
  ).map((c) => ({ imageUrl: toDisplayImageUrl(c.imageUrl) ?? c.imageUrl, caption: c.caption }));

  const images = product.media
    .filter((m) => (m.type as unknown as string) !== "VIDEO")
    .map((m) => toDisplayImageUrl(m.url))
    .filter((url): url is string => Boolean(url))
    .map((url) => ({ url }));

  const keyBenefits = (product.keyBenefits ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);

  // Admin-authored WYSIWYG HTML, not user-generated — same trust level as
  // the description block above and blog post content elsewhere. Still
  // sanitized before render, so a compromised admin account can't plant a
  // stored-XSS payload that runs for every visitor.
  function htmlBlock(html: string) {
    // eslint-disable-next-line react/no-danger
    return <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />;
  }

  const tabs = [
    product.ingredients && { id: "ingredients", label: "Ingredients", content: htmlBlock(product.ingredients) },
    product.nutrition && { id: "nutrition", label: "Nutrition", content: htmlBlock(product.nutrition) },
    product.content && { id: "additional", label: "Additional Info", content: htmlBlock(product.content) },
  ].filter((tab): tab is { id: string; label: string; content: ReactElement } => Boolean(tab));

  return (
    <main className="flex-1">
      {product.structuredData.map((item, i) => (
        // eslint-disable-next-line react/no-danger
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }} />
      ))}

      <div className="mx-auto max-w-[1180px] px-5">
        <AppBreadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Shop", href: "/products" },
            ...(category ? [{ label: category.name, href: `/categories/${category.slug}` }] : []),
            { label: product.name },
          ]}
        />

        <div className="grid grid-cols-[6fr_5fr] items-start gap-11 pb-4 max-lg:grid-cols-1">
          <ProductGallery images={images} videoUrl={toEmbeddableVideoUrl(product.videoUrl)} />

          <div>
            {category && (
              <div className="mb-1 font-ui text-xs font-semibold uppercase tracking-wide text-gold-dark">
                {category.name}
              </div>
            )}
            <h1 className="mb-3 font-serif text-3xl font-semibold text-ink">{product.name}</h1>
            {reviews && reviews.reviewCount > 0 && (
              <RatingStars rating={reviews.averageRating ?? 0} count={reviews.reviewCount} className="mb-3" />
            )}
            {product.description && (
              // Admin-authored WYSIWYG HTML, not user-generated — safe per
              // backend's own content.util.ts docs (same pattern already
              // used for blog post content). Was previously rendered as
              // plain text, showing raw `<p><strong>` tags on the page.
              // eslint-disable-next-line react/no-danger
              <div
                className="mb-5 font-body text-sm leading-relaxed text-muted [&_strong]:font-semibold [&_strong]:text-ink"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description) }}
              />
            )}

            {keyBenefits.length > 0 && (
              <div className="mb-6">
                <h2 className="mb-3 font-ui text-sm font-semibold text-ink">Key Benefits</h2>
                <div className="grid grid-cols-2 gap-3.5">
                  {keyBenefits.map((benefit, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-11 w-11 shrink-0 rounded-[10px] bg-beige" aria-hidden />
                      <span className="font-ui text-[13px] leading-snug text-ink">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <WatchingNowBadge productId={product.id} />

            <PdpPurchasePanel product={product} whatsappConfig={(whatsappRes.data as WhatsappConfig | undefined) ?? null} />

            <ProductTabs tabs={tabs} />
          </div>
        </div>
      </div>

      {marketingReviewCards.length > 0 && (
        <MarketingReviewSection cards={marketingReviewCards} backgroundImageUrl={MARKETING_REVIEW_BG_URL} />
      )}

      <ProductInfoVisual
        mainImageUrl={product.infoVisualImages?.main}
        topHeadingHtml={product.infoVisualContent?.topHeading}
        bottomHeadingHtml={product.infoVisualContent?.bottomHeading}
        arrows={product.infoVisualContent?.arrows ?? []}
        circles={(product.infoVisualImages?.circles ?? []).map((imageUrl, i) => ({
          imageUrl,
          label: product.infoVisualContent?.circleLabels?.[i],
        }))}
      />

      <ComparisonSection
        headingHtml={product.comparisonContent?.heading}
        card1={
          product.comparisonImages?.card1 || product.comparisonContent?.card1
            ? {
                imageUrl: product.comparisonImages?.card1,
                title: product.comparisonContent?.card1?.title,
                items: product.comparisonContent?.card1?.items,
              }
            : null
        }
        card2={
          product.comparisonImages?.card2 || product.comparisonContent?.card2
            ? {
                imageUrl: product.comparisonImages?.card2,
                title: product.comparisonContent?.card2?.title,
                items: product.comparisonContent?.card2?.items,
              }
            : null
        }
      />

      <ProductCarouselSectionClient heading="Related Products" products={relatedProducts} />

      <div className="mx-auto max-w-[1180px] px-5 py-9">
        <SectionHeading>Customer Reviews</SectionHeading>

        {reviews && reviews.items.length > 0 && (
          <div className="mx-auto mb-6 max-w-2xl space-y-4">
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

      <ProductCarouselSection
        heading="Frequently Bought Together"
        products={combos}
        viewAllHref="/combos"
        viewAllLabel="View All"
        linkComponent={AppLink}
      />
    </main>
  );
}
