import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { SectionHeading } from "@amader/ui";
import { getLanguageAlternates } from "@/i18n/alternates";
import { safeGet } from "@/lib/api/client";
import { toApiLocale } from "@/lib/api-locale";
import { redirectIfMapped } from "@/lib/redirects";
import type { components } from "@/lib/api/schema";
import { toProductCardData } from "@/lib/product-card-mapper";
import { isFilteredView, parsePlpSearchParams, type PlpSearchParams } from "@/lib/plp";
import { ProductListing } from "@/components/ProductListing";

// ISR per §7 (on-demand revalidation still needs the backend side — §14).
export const revalidate = 3600;

const PAGE_SIZE = 24;

async function getTag(slug: string, locale: string) {
  const res = await safeGet("/api/v1/tags/{slug}", {
    params: { path: { slug }, query: { locale } },
  });
  return res.data as components["schemas"]["PublicTagDetailDto"] | undefined;
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
  const tag = await getTag(slug, toApiLocale(locale));
  if (!tag) {
    await redirectIfMapped(`/tags/${slug}`, locale);
    notFound();
  }

  const path = `/tags/${slug}`;
  return {
    title: tag.seo.title,
    description: tag.seo.description ?? undefined,
    alternates: { canonical: path, languages: getLanguageAlternates(path) },
    robots: isFilteredView(filters) ? { index: false, follow: true } : undefined,
  };
}

export default async function TagPage({
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

  const tag = await getTag(slug, localeParam);
  if (!tag) {
    await redirectIfMapped(`/tags/${slug}`, locale);
    notFound();
  }

  const productsRes = await safeGet("/api/v1/products", {
    params: {
      query: {
        locale: localeParam,
        page: filters.page,
        pageSize: PAGE_SIZE,
        tagIds: [tag.id],
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        sort: filters.sort,
      },
    },
  });

  const products = (productsRes.data?.items ?? []).map(toProductCardData);
  const total = productsRes.data?.total ?? 0;

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-[1180px] px-5 pt-9">
        <SectionHeading>{tag.name}</SectionHeading>
        {tag.description && (
          <p className="mx-auto -mt-4 mb-6 max-w-2xl text-center font-body text-sm text-muted">{tag.description}</p>
        )}
      </div>
      <ProductListing
        basePath={`/tags/${slug}`}
        filters={filters}
        total={total}
        pageSize={PAGE_SIZE}
        products={products}
        tags={[]}
      />
    </main>
  );
}
