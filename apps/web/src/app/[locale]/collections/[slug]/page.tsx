import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getLanguageAlternates } from "@/i18n/alternates";
import { safeGet } from "@/lib/api/client";
import { toApiLocale } from "@/lib/api-locale";
import { toProductCardData } from "@/lib/product-card-mapper";
import { parsePlpSearchParams, type FlagLabelValue, type PlpSearchParams } from "@/lib/plp";
import { redirectIfMapped } from "@/lib/redirects";
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

async function getCollection(slug: string, locale: string) {
  const res = await safeGet("/api/v1/collections/{slug}", {
    params: { path: { slug }, query: { locale } },
  });
  return res.data;
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
      title: collection.seo.ogTitle,
      description: collection.seo.ogDescription ?? undefined,
      images: collection.seo.ogImageUrl ? [collection.seo.ogImageUrl] : undefined,
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
  const tagMap = new Map<number, { id: number; name: string }>();
  for (const p of collection.products as PublicProductDto[]) {
    for (const c of p.categories) {
      const existing = categoryMap.get(c.id);
      if (existing) existing.productCount += 1;
      else categoryMap.set(c.id, { id: c.id, slug: c.slug, name: c.name, productCount: 1 });
    }
    if (p.brand) brandMap.set(p.brand.id, p.brand);
    for (const t of p.tags) tagMap.set(t.id, { id: t.id, name: t.name });
  }

  const filteredProducts = collection.products.filter((p: PublicProductDto) => {
    const price = effectivePrice(p);
    if (filters.minPrice !== undefined && price < filters.minPrice) return false;
    if (filters.maxPrice !== undefined && price > filters.maxPrice) return false;
    if (filters.categoryIds.length > 0 && !p.categories.some((c) => filters.categoryIds.includes(c.id))) return false;
    if (filters.brandId !== undefined && p.brand?.id !== filters.brandId) return false;
    if (filters.tagIds.length > 0 && !p.tags.some((t) => filters.tagIds.includes(t.id))) return false;
    if (filters.flagLabels.length > 0 && !(p.flagLabel && filters.flagLabels.includes(p.flagLabel as unknown as FlagLabelValue)))
      return false;
    return true;
  });

  const total = filteredProducts.length;
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const start = (filters.page - 1) * pageSize;
  const products = filteredProducts.slice(start, start + pageSize).map(toProductCardData);

  return (
    <main className="flex-1">
      {collection.description && (
        <div className={`${CONTAINER_CLASSNAME} pt-5`}>
          <CollectionDescription description={collection.description} />
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
        tags={Array.from(tagMap.values())}
        priceBounds={priceBounds}
        hidePlaceholderBanner
        title={collection.name}
        breadcrumbItems={[{ label: "Home", href: "/" }, { label: collection.name }]}
        containerClassName={CONTAINER_CLASSNAME}
      />
    </main>
  );
}
