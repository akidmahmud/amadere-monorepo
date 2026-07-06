import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import {
  ProductGallery,
  ProductTabs,
  ProductCarouselSection,
  RatingStars,
  SectionHeading,
} from "@amader/ui";
import { AppLink } from "@/components/AppLink";
import { AppBreadcrumb } from "@/components/AppBreadcrumb";
import { PdpPurchasePanel } from "@/components/PdpPurchasePanel";
import { getLanguageAlternates } from "@/i18n/alternates";
import { safeGet } from "@/lib/api/client";
import { toApiLocale } from "@/lib/api-locale";
import type { components } from "@/lib/api/schema";
import { toDisplayImageUrl, toEmbeddableVideoUrl } from "@/lib/media";
import { toProductCardData } from "@/lib/product-card-mapper";

type PublicProductDetailDto = components["schemas"]["PublicProductDetailDto"];
type PublicBundleDto = components["schemas"]["PublicBundleDto"];

// Generic, non-product-specific trust signals — no backend field carries
// real per-product benefit claims (only description/content/nutrition/
// ingredients), and inventing specific health claims here would be a real
// compliance risk on a food/supplement site. Same "static, no data behind
// it" pattern already used for FeatureTile/CertificationRow before B13.
const TRUST_SIGNALS = [
  "Ethically Sourced",
  "Quality Checked",
  "Fast Delivery",
  "Easy Returns",
];

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
  if (!product) notFound();

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
  if (!product) notFound();

  const category = product.categories[0];

  const [reviewsRes, relatedRes, combosRes] = await Promise.all([
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
  ]);

  const reviews = reviewsRes.data as components["schemas"]["ProductReviewsPageDto"] | undefined;
  const relatedProducts = ((relatedRes.data?.items ?? []) as components["schemas"]["PublicProductDto"][])
    .filter((p) => p.id !== product.id)
    .slice(0, 8)
    .map(toProductCardData);
  const combos = (combosRes.data?.items ?? []).map(toBundleCardData);

  const images = product.media
    .filter((m) => (m.type as unknown as string) !== "VIDEO")
    .map((m) => toDisplayImageUrl(m.url))
    .filter((url): url is string => Boolean(url))
    .map((url) => ({ url }));

  const tabs = [
    product.description && { id: "description", label: "Description", content: product.description },
    product.ingredients && { id: "ingredients", label: "Ingredients", content: product.ingredients },
    product.nutrition && { id: "nutrition", label: "Nutrition", content: product.nutrition },
    product.content && { id: "additional", label: "Additional Info", content: product.content },
  ].filter((tab): tab is { id: string; label: string; content: string } => Boolean(tab));

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

        <div className="grid grid-cols-2 gap-11 pb-12 max-lg:grid-cols-1">
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
              <p className="mb-5 font-body text-sm leading-relaxed text-muted">{product.description}</p>
            )}

            <div className="mb-6 grid grid-cols-2 gap-3.5">
              {TRUST_SIGNALS.map((signal) => (
                <div key={signal} className="flex items-center gap-2.5 rounded-[10px] border border-line bg-white p-3">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5 shrink-0 text-green">
                    <path d="m9 12 2 2 4-4" />
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                  <span className="font-ui text-[13px] text-ink">{signal}</span>
                </div>
              ))}
            </div>

            <PdpPurchasePanel product={product} />

            <ProductTabs tabs={tabs} />
          </div>
        </div>
      </div>

      {reviews && reviews.items.length > 0 && (
        <div className="mx-auto max-w-[1180px] px-5 py-9">
          <SectionHeading>Customer Reviews</SectionHeading>
          <div className="mx-auto max-w-2xl space-y-4">
            {reviews.items.map((review) => (
              <div key={review.id} className="rounded-brand border border-line bg-white p-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="font-ui text-sm font-semibold text-ink">{review.customerName}</span>
                  <RatingStars rating={review.rating} />
                </div>
                {review.comment && <p className="font-body text-sm text-muted">{review.comment}</p>}
                {review.reply && (
                  <p className="mt-2 border-l-2 border-green pl-3 font-body text-xs text-muted">
                    <span className="font-semibold text-ink">Reply: </span>
                    {review.reply.message}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <ProductCarouselSection
        heading="Related Products"
        products={relatedProducts}
        linkComponent={AppLink}
      />

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
