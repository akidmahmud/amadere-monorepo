import type { Metadata } from "next";
import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import {
  Carousel,
  ComboCard,
  ProductGallery,
  ProductTabs,
  RatingStars,
  SectionHeading,
  WatchingNowBadge,
  ProductComparisonTable,
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

async function getProduct(slug: string, locale: string, previewToken?: string) {
  const res = await safeGet("/api/v1/products/{slug}", {
    params: { path: { slug }, query: { locale, previewToken } },
  });
  return res.data as PublicProductDetailDto | undefined;
}

function toComboCardData(bundle: PublicBundleDto) {
  return {
    href: `/combos/${bundle.slug}`,
    name: bundle.name,
    price: bundle.price,
    originalPrice: bundle.originalPrice ?? undefined,
    imageUrl: toDisplayImageUrl(bundle.imageUrl),
  };
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

  const [reviewsRes, relatedRes, combosRes, whatsappRes] = await Promise.all([
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
    // Same config on every product page too — powers the WhatsApp order button.
    safeGet("/api/v1/whatsapp/config"),
  ]);

  const reviews = reviewsRes.data as components["schemas"]["ProductReviewsPageDto"] | undefined;
  const relatedProducts = ((relatedRes.data?.items ?? []) as components["schemas"]["PublicProductDto"][])
    .filter((p) => p.id !== product.id)
    .slice(0, 8)
    .map(toProductCardData);
  const combos = (combosRes.data?.items ?? []).map(toComboCardData);

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
    return <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />;
  }

  const tabs = [
    product.content && { id: "description", label: "Description", content: htmlBlock(product.content) },
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
  ].filter((tab): tab is { id: string; label: string; content: ReactElement } => Boolean(tab));

  return (
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
            {/* Compact on mobile (18px, matching ghorerbazar's mobile PDP
                hero) — full size on desktop, unchanged. */}
            <h1 className="mb-2 font-serif text-lg font-semibold text-ink md:mb-3 md:text-3xl">{product.name}</h1>
            {reviews && reviews.reviewCount > 0 && (
              <RatingStars rating={reviews.averageRating ?? 0} count={reviews.reviewCount} className="mb-3" />
            )}
            {product.description && (
              // Admin-authored WYSIWYG HTML, not user-generated — safe per
              // backend's own content.util.ts docs (same pattern already
              // used for blog post content). Was previously rendered as
              // plain text, showing raw `<p><strong>` tags on the page.
              // Hidden on mobile — the fuller "About This Product" section
              // further down covers the same content there.
              // eslint-disable-next-line react/no-danger
              <div
                className="mb-5 hidden font-body text-sm leading-relaxed text-muted [&_strong]:font-semibold [&_strong]:text-ink md:block"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description) }}
              />
            )}

            <WatchingNowBadge productId={product.id} />

            <PdpPurchasePanel product={product} whatsappConfig={(whatsappRes.data as WhatsappConfig | undefined) ?? null} />
          </div>
        </div>

        {product.description && (
          <div className="mx-auto max-w-[820px] py-14 text-center">
            <SectionHeading>About This Product</SectionHeading>
            <div
              className="font-body text-sm leading-loose text-text"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description) }}
            />
          </div>
        )}

        <ProductTabs tabs={tabs} />
      </div>

      <ProductComparisonTable
        title={product.comparisonTable?.title}
        ownLabel={product.comparisonTable?.ownLabel || product.name}
        competitorLabel={product.comparisonTable?.competitorLabel}
        rows={(product.comparisonTable?.rows ?? [])
          .filter((row) => row.feature)
          .map((row) => ({ feature: row.feature!, own: row.own ?? false, competitor: row.competitor ?? false }))}
      />

      {/* ProductCarouselSection has no built-in max-width/gutter of its own
          (shared with the homepage's edge-to-edge usage) — capped here to
          match every other section's containment on this page. */}
      <div className="mx-auto max-w-[1180px] px-5">
        <ProductCarouselSectionClient
          heading="Related Products"
          products={relatedProducts}
          visibleCount={4}
          autoplayMs={4000}
        />
      </div>

      <div className="mx-auto max-w-[1180px] px-5 py-14">
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

      {combos.length > 0 && (
        <div className="mx-auto max-w-[1180px] px-5 py-14">
          <SectionHeading>Frequently Bought Together</SectionHeading>
          <Carousel>
            {combos.map((combo: ReturnType<typeof toComboCardData>) => (
              <ComboCard key={combo.href} {...combo} linkComponent={AppLink} />
            ))}
          </Carousel>
        </div>
      )}
    </main>
  );
}
