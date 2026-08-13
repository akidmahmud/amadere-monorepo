import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { SectionHeading } from "@amader/ui";
import { getLanguageAlternates } from "@/i18n/alternates";
import { safeGet } from "@/lib/api/client";
import { toApiLocale } from "@/lib/api-locale";
import type { components } from "@/lib/api/schema";
import { toProductCardData } from "@/lib/product-card-mapper";
import { isFilteredView, parsePlpSearchParams, type PlpSearchParams } from "@/lib/plp";
import { redirectIfMapped } from "@/lib/redirects";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { toDisplayImageUrl } from "@/lib/media";
import { ProductListing } from "@/components/ProductListing";
import { CollectionDescription } from "@/components/CollectionDescription";

// ISR per §7 (on-demand revalidation still needs the backend side — §14).
export const revalidate = 3600;

const PAGE_SIZE = 24;

async function getCategory(slug: string, locale: string) {
  const res = await safeGet("/api/v1/categories/{slug}", {
    params: { path: { slug }, query: { locale } },
  });
  return res.data as components["schemas"]["PublicCategoryDetailDto"] | undefined;
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

  const [productsRes, tagsRes, brandsRes] = await Promise.all([
    safeGet("/api/v1/products", {
      params: {
        query: {
          locale: localeParam,
          page: filters.page,
          pageSize,
          categoryIds: [category.id],
          tagIds: filters.tagIds,
          brandId: filters.brandId,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
          sort: filters.sort,
        },
      },
    }),
    safeGet("/api/v1/tags", {
      params: { query: { locale: localeParam, pageSize: 20 } },
    }),
    safeGet("/api/v1/brands", {
      params: { query: { locale: localeParam, pageSize: 50 } },
    }),
  ]);

  const products = (productsRes.data?.items ?? []).map(toProductCardData);
  const total = productsRes.data?.total ?? 0;
  const tags = (tagsRes.data?.items ??
    []) as components["schemas"]["PublicTagDto"][];
  const brands = (brandsRes.data?.items ??
    []) as components["schemas"]["PublicBrandDto"][];

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-[1180px] px-5 pt-9">
        <SectionHeading>{category.name}</SectionHeading>

        {toDisplayImageUrl(category.bannerImageUrl) && (
          <img
            src={toDisplayImageUrl(category.bannerImageUrl)}
            alt={category.name}
            className="-mt-4 mb-6 aspect-[1180/300] w-full rounded-brand object-cover"
          />
        )}

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
        tags={tags}
        brands={brands}
        hidePlaceholderBanner
      />
    </main>
  );
}
