import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getLanguageAlternates } from "@/i18n/alternates";
import { safeGet } from "@/lib/api/client";
import { toApiLocale } from "@/lib/api-locale";
import type { components } from "@/lib/api/schema";
import { toDisplayImageUrl, IMG } from "@/lib/media";
import { toProductCardData } from "@/lib/product-card-mapper";
import { isFilteredView, parsePlpSearchParams, type PlpSearchParams } from "@/lib/plp";
import { ProductListing } from "@/components/ProductListing";

const PAGE_SIZE = 24;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<PlpSearchParams>;
}): Promise<Metadata> {
  const filters = parsePlpSearchParams(await searchParams);
  return {
    title: "All Products",
    alternates: { canonical: "/products", languages: getLanguageAlternates("/products") },
    robots: isFilteredView(filters) ? { index: false, follow: true } : undefined,
  };
}

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<PlpSearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const localeParam = toApiLocale(locale);
  const filters = parsePlpSearchParams(await searchParams);
  const pageSize = filters.pageSize ?? PAGE_SIZE;

  const [productsRes, collectionsRes, brandsRes, siteInfoRes] = await Promise.all([
    safeGet("/api/v1/products", {
      params: {
        query: {
          locale: localeParam,
          page: filters.page,
          pageSize,
          categoryIds: filters.categoryIds,
          brandId: filters.brandId,
          collectionIds: filters.collectionIds,
          flagLabels: filters.flagLabels,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
          sort: filters.sort,
        },
      },
    }),
    safeGet("/api/v1/collections", {
      params: { query: { locale: localeParam, pageSize: 50 } },
    }),
    safeGet("/api/v1/brands", {
      params: { query: { locale: localeParam, pageSize: 50 } },
    }),
    safeGet("/api/v1/settings/site"),
  ]);

  const products = (productsRes.data?.items ?? []).map(toProductCardData);
  const total = productsRes.data?.total ?? 0;
  const collections = (collectionsRes.data?.items ??
    []) as components["schemas"]["PublicCollectionSummaryDto"][];
  const brands = (brandsRes.data?.items ??
    []) as components["schemas"]["PublicBrandDto"][];
  // Raw <img>, so it gets an explicit srcset rather than one fixed width.
  // Measured on production at a 412px viewport: a single 1600w file was being
  // downloaded for a 357x91 display box — a 4.5x overshoot on exactly the
  // devices that can least afford it.
  const bannerSrc = siteInfoRes.data?.productsPageBannerUrl;
  const bannerUrl = toDisplayImageUrl(bannerSrc, IMG.banner);
  const bannerSrcSet = bannerSrc
    ? [480, 768, 1140, 1600]
        .map((w) => `${toDisplayImageUrl(bannerSrc, w)} ${w}w`)
        .join(", ")
    : undefined;

  return (
    <main className="flex-1">
      {bannerUrl && (
        <div className="mx-auto max-w-[1600px] px-5 pt-6">
          {/* 1600 wide, matching the 1600x500 the admin asks for and the
              other banners on the site. It was capped at 1180 (1140 after
              padding), so a correct upload was scaled down as well as
              cropped. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bannerUrl}
            srcSet={bannerSrcSet}
            sizes="(max-width: 1640px) calc(100vw - 40px), 1600px"
            width={1600}
            height={500}
            // Above the fold and a strong LCP candidate on this route: eager,
            // and hinted so it is not queued behind lazy imagery further down.
            fetchPriority="high"
            alt="All Products Banner"
            // 16:5, same as every other banner and the 1600x500 the admin
            // asks people to upload. 1180/300 (3.93:1) cropped it.
            className="aspect-[16/5] w-full rounded-brand object-cover"
          />
        </div>
      )}
      <ProductListing
        basePath="/products"
        filters={filters}
        total={total}
        pageSize={pageSize}
        products={products}
        collections={collections}
        brands={brands}
        title="All Products"
        breadcrumbItems={[{ label: "Home", href: "/" }, { label: "All Products" }]}
        hidePlaceholderBanner={!!bannerUrl}
      />
    </main>
  );
}
