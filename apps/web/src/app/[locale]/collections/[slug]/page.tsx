import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getLanguageAlternates } from "@/i18n/alternates";
import { api, ApiError } from "@/lib/api/client";
import { toApiLocale } from "@/lib/api-locale";
import { toProductCardData } from "@/lib/product-card-mapper";
import { parsePlpSearchParams, type FlagLabelValue, type PlpSearchParams } from "@/lib/plp";
import { redirectIfMapped } from "@/lib/redirects";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { toOgImageUrl } from "@/lib/media";
import { ProductListing } from "@/components/ProductListing";
import { CollectionDescription } from "@/components/CollectionDescription";
import type { components } from "@/lib/api/schema";

type PublicProductDto = components["schemas"]["PublicProductDto"];

// ISR per §7 (on-demand revalidation still needs the backend side — §14).
export const revalidate = 3600;

// Pixel-matched to ghorerbazar.com's offer-zone collection page, which shows
// 16 per page by default — this collection endpoint has no server-side
// pagination (see the comment on `effectivePrice` below), so paging happens
// here against the already-fetched full set instead.
const DEFAULT_PAGE_SIZE = 16;

// Explicit request: 207px side margin/gap on this page specifically (not
// site-wide — /products, /categories, etc. keep their existing px-5). Only
// applied from lg up; at 207px a side it would leave nothing for content on
// a phone screen.
const CONTAINER_CLASSNAME = "mx-auto max-w-[1920px] px-5 lg:px-[207px]";

async function getCollection(slug: string, locale: "EN" | "BN") {
  try {
    const res = await api.GET("/api/v1/collections/{slug}", {
      params: { path: { slug }, query: { locale } },
    });
    return res.data;
  } catch (err) {
    // See categories/[slug]/page.tsx's getCategory for why only a real
    // 404 is treated as not-found here, not any other kind of failure.
    if (err instanceof ApiError && err.status === 404) return undefined;
    throw err;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const collection = await getCollection(slug, toApiLocale(locale));
  if (!collection) {
    await redirectIfMapped(`/collections/${slug}`, locale);
    notFound();
  }

  const path = `/collections/${slug}`;
  return {
    title: collection.seo.title,
    description: collection.seo.description ?? undefined,
    alternates: { canonical: path, languages: getLanguageAlternates(path) },
    openGraph: {
      // Same `path` as the canonical above. Next only emits og:url when
      // openGraph.url is set — metadataBase makes it absolute but does not
      // create it — and Facebook's Sharing Debugger reports a missing og:url
      // as an error. Product pages already did this; these did not.
      url: path,
      title: collection.seo.ogTitle,
      description: collection.seo.ogDescription ?? undefined,
      images: toOgImageUrl(collection.seo.ogImageUrl) ? [toOgImageUrl(collection.seo.ogImageUrl)!] : undefined,
    },
  };
}

export default async function CollectionPage({
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

  const collection = await getCollection(slug, localeParam);
  if (!collection) {
    await redirectIfMapped(`/collections/${slug}`, locale);
    notFound();
  }

  // The collection endpoint returns every product in one shot (no
  // server-side pagination or filtering, unlike /products, /categories,
  // /tags, /brands) — so all filtering happens here against the full set
  // instead. Same "base price, defaulting to the default variant's price"
  // resolution as the backend's own minPrice/maxPrice filter and as
  // toProductCardData's own price display use, so the slider and the price
  // shown on each card never disagree.
  const effectivePrice = (p: PublicProductDto) =>
    Number(p.price ?? p.variants.find((v) => v.isDefault)?.price ?? p.variants[0]?.price ?? 0);

  const allPrices = collection.products.map(effectivePrice);
  const priceBounds =
    allPrices.length > 0 ? { min: Math.min(...allPrices), max: Math.max(...allPrices) } : undefined;

  // Derived from this collection's own product set (not a separate API
  // call) — category/brand/tag counts only make sense scoped to what's
  // actually in this collection, same reasoning as the price bounds above.
  const categoryMap = new Map<number, { id: number; slug: string; name: string; productCount: number }>();
  const brandMap = new Map<number, { id: number; slug: string; name: string }>();
  for (const p of collection.products as PublicProductDto[]) {
    for (const c of p.categories) {
      const existing = categoryMap.get(c.id);
      if (existing) existing.productCount += 1;
      else categoryMap.set(c.id, { id: c.id, slug: c.slug, name: c.name, productCount: 1 });
    }
    if (p.brand) brandMap.set(p.brand.id, p.brand);
  }

  const filteredProducts = collection.products.filter((p: PublicProductDto) => {
    const price = effectivePrice(p);
    if (filters.minPrice !== undefined && price < filters.minPrice) return false;
    if (filters.maxPrice !== undefined && price > filters.maxPrice) return false;
    if (filters.categoryIds.length > 0 && !p.categories.some((c) => filters.categoryIds.includes(c.id))) return false;
    if (filters.brandId !== undefined && p.brand?.id !== filters.brandId) return false;
    if (filters.flagLabels.length > 0 && !(p.flagLabel && filters.flagLabels.includes(p.flagLabel as unknown as FlagLabelValue)))
      return false;
    return true;
  });

  // filters.sort was parsed and forwarded to ProductListing/SortSelect (so
  // the dropdown itself always looked right), but nothing ever reordered
  // filteredProducts with it — every other PLP route hands `sort` straight
  // to the backend's /api/v1/products call, which this route doesn't use.
  // PRICE_ASC/PRICE_DESC are fully client-derivable from the same
  // effectivePrice() the price filter already uses. NEWEST/BEST_SELLING
  // aren't: PublicProductDto (this endpoint's response shape) carries
  // neither createdAt nor viewCount, so there's nothing to sort by — those
  // two fall back to the collection's own curated order (collection_products
  // sortOrder), same as before this fix, rather than silently faking a
  // "newest"/"best selling" order this page has no data to back up.
  const sortedProducts =
    filters.sort === "PRICE_ASC" || filters.sort === "PRICE_DESC"
      ? [...filteredProducts].sort((a, b) => {
          const diff = effectivePrice(a) - effectivePrice(b);
          return filters.sort === "PRICE_DESC" ? -diff : diff;
        })
      : filteredProducts;

  const total = sortedProducts.length;
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const start = (filters.page - 1) * pageSize;
  const products = sortedProducts.slice(start, start + pageSize).map(toProductCardData);

  return (
    <main className="flex-1">
      {collection.description && (
        <div className={`${CONTAINER_CLASSNAME} pt-5`}>
          {/* Admin-authored WYSIWYG HTML (via RichTextEditor), not plain text
              — sanitized the same way the category page's own description is. */}
          <CollectionDescription description={sanitizeHtml(collection.description)} html />
        </div>
      )}
      <ProductListing
        basePath={`/collections/${slug}`}
        filters={filters}
        total={total}
        pageSize={pageSize}
        products={products}
        categories={Array.from(categoryMap.values())}
        brands={Array.from(brandMap.values())}
        priceBounds={priceBounds}
        hidePlaceholderBanner
        title={collection.name}
        breadcrumbItems={[{ label: "Home", href: "/" }, { label: collection.name }]}
        containerClassName={CONTAINER_CLASSNAME}
      />
    </main>
  );
}
