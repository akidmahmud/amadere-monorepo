import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { ComboCard, SectionHeading } from "@amader/ui";
import { AppLink } from "@/components/AppLink";
import { AppBreadcrumb } from "@/components/AppBreadcrumb";
import { ComboPager } from "@/components/ComboPager";
import { getLanguageAlternates } from "@/i18n/alternates";
import { safeGet } from "@/lib/api/client";
import { toApiLocale } from "@/lib/api-locale";
import { toDisplayImageUrl } from "@/lib/media";
import type { components } from "@/lib/api/schema";

type PublicBundleDto = components["schemas"]["PublicBundleDto"];

// ISR per §7, same as every other listing page.
export const revalidate = 3600;

const PAGE_SIZE = 12;

export function generateMetadata(): Metadata {
  return {
    title: "Combo Offers",
    alternates: { canonical: "/combos", languages: getLanguageAlternates("/combos") },
  };
}

export default async function CombosPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const localeParam = toApiLocale(locale);
  const page = Math.max(1, Number((await searchParams).page) || 1);

  const res = await safeGet("/api/v1/product-bundles", {
    params: { query: { locale: localeParam, page, pageSize: PAGE_SIZE } },
  });
  const bundles = res.data?.items ?? [];
  const total = res.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-[1180px] px-5 pt-9">
        <AppBreadcrumb items={[{ label: "Home", href: "/" }, { label: "Combo Offers" }]} />
        <SectionHeading>Combo Offers</SectionHeading>

        {bundles.length === 0 ? (
          <p className="py-14 text-center font-body text-sm text-muted">No combo offers available right now — check back soon.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-5 py-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {bundles.map((bundle: PublicBundleDto) => (
                <ComboCard
                  key={bundle.slug}
                  href={`/combos/${bundle.slug}`}
                  name={bundle.name}
                  price={bundle.price}
                  originalPrice={bundle.originalPrice ?? undefined}
                  imageUrl={toDisplayImageUrl(bundle.imageUrl)}
                  linkComponent={AppLink}
                />
              ))}
            </div>
            <ComboPager page={page} totalPages={totalPages} />
          </>
        )}
      </div>
    </main>
  );
}
