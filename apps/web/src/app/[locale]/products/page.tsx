import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getLanguageAlternates } from "@/i18n/alternates";
import { safeGet } from "@/lib/api/client";
import { toApiLocale } from "@/lib/api-locale";
import type { components } from "@/lib/api/schema";
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

  const [productsRes, categoriesRes, tagsRes] = await Promise.all([
    safeGet("/api/v1/products", {
      params: {
        query: {
          locale: localeParam,
          page: filters.page,
          pageSize: PAGE_SIZE,
          categoryId: filters.categoryId,
          tagId: filters.tagId,
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
  ]);

  const products = (productsRes.data?.items ?? []).map(toProductCardData);
  const total = productsRes.data?.total ?? 0;
  const categories = (categoriesRes.data?.items ??
    []) as components["schemas"]["PublicCategoryDto"][];
  const tags = (tagsRes.data?.items ??
    []) as components["schemas"]["PublicTagDto"][];

  return (
    <main className="flex-1">
      <ProductListing
        basePath="/products"
        filters={filters}
        total={total}
        pageSize={PAGE_SIZE}
        products={products}
        categories={categories}
        tags={tags}
      />
    </main>
  );
}
