import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { SectionHeading } from "@amader/ui";
import { getLanguageAlternates } from "@/i18n/alternates";
import { safeGet } from "@/lib/api/client";
import { toApiLocale } from "@/lib/api-locale";
import { toProductCardData } from "@/lib/product-card-mapper";
import { parsePlpSearchParams, type PlpSearchParams } from "@/lib/plp";
import { redirectIfMapped } from "@/lib/redirects";
import { ProductListing } from "@/components/ProductListing";

// ISR per §7 (on-demand revalidation still needs the backend side — §14).
export const revalidate = 3600;

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

  const products = collection.products.map(toProductCardData);

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-[1180px] px-5 pt-9">
        <SectionHeading>{collection.name}</SectionHeading>
        {collection.description && (
          <p className="mx-auto -mt-4 mb-6 max-w-2xl text-center font-body text-sm text-muted">
            {collection.description}
          </p>
        )}
      </div>
      <ProductListing
        basePath={`/collections/${slug}`}
        filters={filters}
        total={products.length}
        pageSize={Math.max(products.length, 1)}
        products={products}
        tags={[]}
      />
    </main>
  );
}
