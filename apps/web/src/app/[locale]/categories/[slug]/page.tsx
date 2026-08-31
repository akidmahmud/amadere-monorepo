import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { SectionHeading } from "@amader/ui";
import { getLanguageAlternates } from "@/i18n/alternates";
import { api, ApiError, safeGet } from "@/lib/api/client";
import { toApiLocale } from "@/lib/api-locale";
import type { components } from "@/lib/api/schema";
import { toProductCardData } from "@/lib/product-card-mapper";
import { isFilteredView, parsePlpSearchParams, type PlpSearchParams } from "@/lib/plp";
import { redirectIfMapped } from "@/lib/redirects";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { toDisplayImageUrl, IMG } from "@/lib/media";
import { ProductListing } from "@/components/ProductListing";
import { CollectionDescription } from "@/components/CollectionDescription";

// ISR per §7 (on-demand revalidation still needs the backend side — §14).
export const revalidate = 3600;

const PAGE_SIZE = 24;

async function getCategory(slug: string, locale: "EN" | "BN") {
  try {
    const res = await api.GET("/api/v1/categories/{slug}", {
      params: { path: { slug }, query: { locale } },
    });
    return res.data as components["schemas"]["PublicCategoryDetailDto"] | undefined;
  } catch (err) {
    // A real "no such category" — safe to treat as not-found. Anything else
    // (network blip, backend 5xx/429) must NOT be swallowed into "not
    // found" the way safeGet() does — this route's 1-hour ISR cache would
    // then bake a single transient hiccup into a false 404 for up to an
    // hour. See apps/web's catch-all [...path]/page.tsx for the same fix.
    if (err instanceof ApiError && err.status === 404) return undefined;
    throw err;
  }
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<PlpSearchParams>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const filters = parsePlpSearchParams(await searchParams);
  const category = await getCategory(slug, toApiLocale(locale));
  if (!category) {
    await redirectIfMapped(`/categories/${slug}`, locale);
    notFound();
  }

  const path = `/categories/${slug}`;
  return {
    title: category.seo.title,
    description: category.seo.description ?? undefined,
    alternates: { canonical: path, languages: getLanguageAlternates(path) },
    robots: isFilteredView(filters) ? { index: false, follow: true } : undefined,
    openGraph: {
      // Same `path` as the canonical above. Next only emits og:url when
      // openGraph.url is set — metadataBase makes it absolute but does not
      // create it — and Facebook's Sharing Debugger reports a missing og:url
      // as an error. Product pages already did this; these did not.
      url: path,
      title: category.seo.ogTitle,
      description: category.seo.ogDescription ?? undefined,
      images: category.seo.ogImageUrl ? [category.seo.ogImageUrl] : undefined,
    },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<PlpSearchParams>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const localeParam = toApiLocale(locale);
  const filters = parsePlpSearchParams(await searchParams);
  const pageSize = filters.pageSize ?? PAGE_SIZE;

  const category = await getCategory(slug, localeParam);
  if (!category) {
    await redirectIfMapped(`/categories/${slug}`, locale);
    notFound();
  }

  const [productsRes, brandsRes, cheapestRes, priciestRes] = await Promise.all([
    safeGet("/api/v1/products", {
      params: {
        query: {
          locale: localeParam,
          page: filters.page,
          pageSize,
          categoryIds: [category.id],
          brandId: filters.brandId,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
          sort: filters.sort,
        },
      },
    }),
    safeGet("/api/v1/brands", {
      params: { query: { locale: localeParam, pageSize: 50 } },
    }),
    // Price bounds for the slider, across this category's full (unfiltered)
    // product set — same idea as the collection page's own priceBounds, but
    // a category has no ready-made "full set" response to derive it from,
    // so it's two 1-item requests sorted to each extreme instead of pulling
    // every product just to find min/max.
    safeGet("/api/v1/products", {
      params: { query: { locale: localeParam, categoryIds: [category.id], pageSize: 1, sort: "PRICE_ASC" } },
    }),
    safeGet("/api/v1/products", {
      params: { query: { locale: localeParam, categoryIds: [category.id], pageSize: 1, sort: "PRICE_DESC" } },
    }),
  ]);

  const products = (productsRes.data?.items ?? []).map(toProductCardData);
  const total = productsRes.data?.total ?? 0;
  const brands = (brandsRes.data?.items ??
    []) as components["schemas"]["PublicBrandDto"][];

  const effectivePrice = (p: components["schemas"]["PublicProductDto"]) =>
    Number(p.price ?? p.variants.find((v) => v.isDefault)?.price ?? p.variants[0]?.price ?? 0);
  const cheapest = cheapestRes.data?.items?.[0];
  const priciest = priciestRes.data?.items?.[0];
  const priceBounds = cheapest && priciest ? { min: effectivePrice(cheapest), max: effectivePrice(priciest) } : undefined;

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-[1180px] px-5 pt-9">
        <SectionHeading as="h1">{category.name}</SectionHeading>
      </div>

      {/* The banner gets its OWN 1600-wide container instead of sitting in
          the page's 1180 content column. 16:5 fixed the cropping, but the
          box was still only ~1140px across, so a 1600x500 upload was scaled
          down to fit a column sized for text. Every banner on the site is
          1600 wide now. */}
      {toDisplayImageUrl(category.bannerImageUrl, IMG.banner) && (
        <div className="mx-auto max-w-[1600px] px-5">
          <img
            src={toDisplayImageUrl(category.bannerImageUrl, IMG.banner)}
            alt={category.name}
            width={1600}
            height={500}
            className="mb-6 aspect-[16/5] w-full rounded-brand object-cover"
          />
        </div>
      )}

      <div className="mx-auto max-w-[1180px] px-5">
        {category.description && (
          // Admin-authored WYSIWYG HTML (via RichTextEditor), not plain text —
          // sanitized the same way blog post content already is. Clamped to
          // 4 lines with a "See more"/"See less" toggle (both mobile and
          // desktop), same component/behavior as the collection page's own
          // description.
          <div className="mb-6">
            <CollectionDescription
              description={sanitizeHtml(category.description)}
              html
              className="prose prose-sm max-w-none text-left [&_a]:text-green [&_a]:underline [&_p]:mb-2"
            />
          </div>
        )}
      </div>
      <ProductListing
        basePath={`/categories/${slug}`}
        filters={filters}
        total={total}
        pageSize={pageSize}
        products={products}
        brands={brands}
        priceBounds={priceBounds}
        hidePlaceholderBanner
      />
    </main>
  );
}
