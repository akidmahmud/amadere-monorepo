import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { SectionHeading } from "@amader/ui";
import { getLanguageAlternates } from "@/i18n/alternates";
import { api, ApiError, safeGet } from "@/lib/api/client";
import { toApiLocale } from "@/lib/api-locale";
import { toDisplayImageUrl } from "@/lib/media";
import { redirectIfMapped } from "@/lib/redirects";
import { sanitizeHtml } from "@/lib/sanitize-html";
import type { components } from "@/lib/api/schema";
import { toProductCardData } from "@/lib/product-card-mapper";
import { isFilteredView, parsePlpSearchParams, type PlpSearchParams } from "@/lib/plp";
import { ProductListing } from "@/components/ProductListing";
import { CollectionDescription } from "@/components/CollectionDescription";

// ISR per §7 (on-demand revalidation still needs the backend side — §14).
export const revalidate = 3600;

const PAGE_SIZE = 24;

async function getBrand(slug: string, locale: "EN" | "BN") {
  try {
    const res = await api.GET("/api/v1/brands/{slug}", {
      params: { path: { slug }, query: { locale } },
    });
    return res.data as components["schemas"]["PublicBrandDetailDto"] | undefined;
  } catch (err) {
    // See categories/[slug]/page.tsx's getCategory for why only a real
    // 404 is treated as not-found here, not any other kind of failure.
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
  const pageSize = filters.pageSize ?? PAGE_SIZE;

  const brand = await getBrand(slug, localeParam);
  if (!brand) {
    await redirectIfMapped(`/brands/${slug}`, locale);
    notFound();
  }

  const [productsRes, tagsRes, categoriesRes] = await Promise.all([
    safeGet("/api/v1/products", {
      params: {
        query: {
          locale: localeParam,
          page: filters.page,
          pageSize,
          brandId: brand.id,
          categoryIds: filters.categoryIds,
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
    safeGet("/api/v1/categories", {
      params: { query: { locale: localeParam, pageSize: 50 } },
    }),
  ]);

  const products = (productsRes.data?.items ?? []).map(toProductCardData);
  const total = productsRes.data?.total ?? 0;
  const tags = (tagsRes.data?.items ?? []) as components["schemas"]["PublicTagDto"][];
  const categories = (categoriesRes.data?.items ?? []) as components["schemas"]["PublicCategoryDto"][];

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-[1180px] px-5 pt-9 text-center">
        {toDisplayImageUrl(brand.logoUrl) && (
          <img src={toDisplayImageUrl(brand.logoUrl)} alt={brand.name} className="mx-auto mb-4 h-16 object-contain" />
        )}
        <SectionHeading>{brand.name}</SectionHeading>
        {brand.description && (
          // Admin-authored WYSIWYG HTML (via RichTextEditor), not plain text
          // — sanitized the same way the category page's own description is.
          <div className="mx-auto -mt-4 mb-6">
            <CollectionDescription description={sanitizeHtml(brand.description)} html className="mx-auto text-center" />
          </div>
        )}
      </div>
      <ProductListing
        basePath={`/brands/${slug}`}
        filters={filters}
        total={total}
        pageSize={pageSize}
        products={products}
        tags={tags}
        categories={categories}
      />
    </main>
  );
}
