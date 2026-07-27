import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { PriceTag } from "@amader/ui";
import { AppBreadcrumb } from "@/components/AppBreadcrumb";
import { AppLink } from "@/components/AppLink";
import { AddComboToCartButton } from "@/components/AddComboToCartButton";
import { getLanguageAlternates } from "@/i18n/alternates";
import { safeGet } from "@/lib/api/client";
import { toApiLocale } from "@/lib/api-locale";
import { toDisplayImageUrl } from "@/lib/media";
import type { components } from "@/lib/api/schema";

type PublicBundleDetailDto = components["schemas"]["PublicBundleDetailDto"];

async function getCombo(slug: string, locale: string): Promise<PublicBundleDetailDto | undefined> {
  const res = await safeGet("/api/v1/product-bundles/{slug}", {
    params: { path: { slug }, query: { locale } },
  });
  return res.data as PublicBundleDetailDto | undefined;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const combo = await getCombo(slug, toApiLocale(locale));
  if (!combo) notFound();

  const path = `/combos/${slug}`;
  return {
    title: combo.seo.title,
    description: combo.seo.description ?? undefined,
    alternates: { canonical: path, languages: getLanguageAlternates(path) },
  };
}

export default async function ComboDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const combo = await getCombo(slug, toApiLocale(locale));
  if (!combo) notFound();

  const hasDiscount = combo.originalPrice != null && Number(combo.originalPrice) > Number(combo.price);
  const savePercent = hasDiscount ? Math.round((1 - Number(combo.price) / Number(combo.originalPrice)) * 100) : 0;
  const imageUrl = toDisplayImageUrl(combo.imageUrl);

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-[1180px] px-5 pt-9 pb-14">
        <AppBreadcrumb items={[{ label: "Home", href: "/" }, { label: "Combo Offers", href: "/combos" }, { label: combo.name }]} />

        <div className="grid grid-cols-1 gap-9 py-6 lg:grid-cols-2">
          <div className="relative aspect-square overflow-hidden rounded-brand bg-beige">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt={combo.name} className="h-full w-full object-contain" />
            ) : null}
            {hasDiscount && (
              <span className="absolute left-4 top-4 rounded-md bg-header-green px-3 py-1.5 text-xs font-extrabold text-white">
                Save {savePercent}%
              </span>
            )}
            <span className="absolute right-4 top-4 rounded-md bg-[#e07b1a] px-3 py-1.5 text-xs font-extrabold text-white">
              Combo Offer
            </span>
          </div>

          <div>
            <h1 className="mb-3 font-header text-2xl font-extrabold text-header-ink">{combo.name}</h1>

            <div className="mb-5 flex items-center gap-3">
              <PriceTag price={combo.price} originalPrice={combo.originalPrice ?? undefined} align="left" />
            </div>

            {combo.description && (
              <p className="mb-6 whitespace-pre-line font-body text-sm leading-relaxed text-muted">{combo.description}</p>
            )}

            <div className="mb-6 rounded-brand border border-line p-4">
              <h2 className="mb-3 font-header text-sm font-bold text-header-ink">What's included</h2>
              <ul className="flex flex-col gap-2.5">
                {combo.items.map((item) => (
                  <li key={item.productId} className="flex items-center justify-between gap-3 text-sm">
                    <AppLink href={`/products/${item.productSlug}`} className="text-header-ink hover:text-header-green hover:underline">
                      {item.productName}
                    </AppLink>
                    <span className="shrink-0 font-semibold text-muted">× {item.quantity}</span>
                  </li>
                ))}
              </ul>
            </div>

            <AddComboToCartButton
              items={combo.items.map((item) => ({
                productId: item.productId,
                variantId: item.variantId,
                quantity: item.quantity,
              }))}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
