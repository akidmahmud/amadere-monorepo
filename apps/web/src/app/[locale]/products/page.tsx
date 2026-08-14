import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getLanguageAlternates } from "@/i18n/alternates";
import { safeGet } from "@/lib/api/client";
import { toApiLocale } from "@/lib/api-locale";
import type { components } from "@/lib/api/schema";
import { toDisplayImageUrl } from "@/lib/media";
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

  const [productsRes, categoriesRes, tagsRes, brandsRes, siteInfoRes] = await Promise.all([
    safeGet("/api/v1/products", {
      params: {
        query: {
          locale: localeParam,
          page: filters.page,
          pageSize,
          categoryIds: filters.categoryIds,
          tagIds: filters.tagIds,
          brandId: filters.brandId,
          flagLabels: filters.flagLabels,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
          sort: filters.sort,
        },
      },
    }),
    safeGet("/api/v1/categories", {
      params: { query: { locale: localeParam, pageSize: 50 } },
    }),
    safeGet("/api/v1/tags", {
      params: { query: { locale: localeParam, pageSize: 20 } },
    }),
    safeGet("/api/v1/brands", {
      params: { query: { locale: localeParam, pageSize: 50 } },
    }),
    safeGet("/api/v1/settings/site"),
  ]);

  const products = (productsRes.data?.items ?? []).map(toProductCardData);
  const total = productsRes.data?.total ?? 0;
  const categories = (categoriesRes.data?.items ??
    []) as components["schemas"]["PublicCategoryDto"][];
  const tags = (tagsRes.data?.items ??
    []) as components["schemas"]["PublicTagDto"][];
  const brands = (brandsRes.data?.items ??
    []) as components["schemas"]["PublicBrandDto"][];
  const bannerUrl = toDisplayImageUrl(siteInfoRes.data?.productsPageBannerUrl);

  return (
    <main className="flex-1">
      {bannerUrl && (
        <div className="mx-auto max-w-[1180px] px-5 pt-6">
          <img
            src={bannerUrl}
            alt="All Products Banner"
            className="aspect-[1180/300] w-full rounded-brand object-cover"
          />
        </div>
      )}
      <ProductListing
        basePath="/products"
        filters={filters}
        total={total}
        pageSize={pageSize}
        products={products}
        categories={categories}
        tags={tags}
        brands={brands}
        title="All Products"
        breadcrumbItems={[{ label: "Home", href: "/" }, { label: "All Products" }]}
        hidePlaceholderBanner={!!bannerUrl}
      />
    </main>
  );
}
