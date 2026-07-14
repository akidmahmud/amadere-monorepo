import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { SectionHeading } from "@amader/ui";
import { getLanguageAlternates } from "@/i18n/alternates";
import { safeGet } from "@/lib/api/client";
import { toApiLocale } from "@/lib/api-locale";
import { toDisplayImageUrl } from "@/lib/media";
import { redirectIfMapped } from "@/lib/redirects";
import type { components } from "@/lib/api/schema";
import { toProductCardData } from "@/lib/product-card-mapper";
import { isFilteredView, parsePlpSearchParams, type PlpSearchParams } from "@/lib/plp";
import { ProductListing } from "@/components/ProductListing";

// ISR per §7 (on-demand revalidation still needs the backend side — §14).
export const revalidate = 3600;

const PAGE_SIZE = 24;

async function getBrand(slug: string, locale: string) {
  const res = await safeGet("/api/v1/brands/{slug}", {
    params: { path: { slug }, query: { locale } },
  });
  return res.data as components["schemas"]["PublicBrandDetailDto"] | undefined;
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
  const brand = await getBrand(slug, toApiLocale(locale));
  if (!brand) {
    await redirectIfMapped(`/brands/${slug}`, locale);
    notFound();
  }

  const path = `/brands/${slug}`;
  return {
    title: brand.seo.title,
    description: brand.seo.description ?? undefined,
    alternates: { canonical: path, languages: getLanguageAlternates(path) },
    robots: isFilteredView(filters) ? { index: false, follow: true } : undefined,
    openGraph: {
      title: brand.seo.ogTitle,
      description: brand.seo.ogDescription ?? undefined,
      images: brand.seo.ogImageUrl ? [brand.seo.ogImageUrl] : undefined,
    },
  };
}

export default async function BrandPage({
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

  const brand = await getBrand(slug, localeParam);
  if (!brand) {
    await redirectIfMapped(`/brands/${slug}`, locale);
    notFound();
  }

  const [productsRes, tagsRes] = await Promise.all([
    safeGet("/api/v1/products", {
      params: {
        query: {
          locale: localeParam,
          page: filters.page,
          pageSize: PAGE_SIZE,
          brandId: brand.id,
          tagIds: filters.tagIds,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
          sort: filters.sort,
        },
      },
    }),
    safeGet("/api/v1/tags", {
      params: { query: { locale: localeParam, pageSize: 20 } },
    }),
  ]);

  const products = (productsRes.data?.items ?? []).map(toProductCardData);
  const total = productsRes.data?.total ?? 0;
  const tags = (tagsRes.data?.items ?? []) as components["schemas"]["PublicTagDto"][];

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-[1180px] px-5 pt-9 text-center">
        {toDisplayImageUrl(brand.logoUrl) && (
          <img src={toDisplayImageUrl(brand.logoUrl)} alt={brand.name} className="mx-auto mb-4 h-16 object-contain" />
        )}
        <SectionHeading>{brand.name}</SectionHeading>
        {brand.description && (
          <p className="mx-auto -mt-4 mb-6 max-w-2xl font-body text-sm text-muted">{brand.description}</p>
        )}
      </div>
      <ProductListing
        basePath={`/brands/${slug}`}
        filters={filters}
        total={total}
        pageSize={PAGE_SIZE}
        products={products}
        tags={tags}
      />
    </main>
  );
}
