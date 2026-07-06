import { ContentStatus, Locale, Prisma } from '@amader/db';
import { ResolvedSeoDto } from '../seo/seo.mapper';

export const BUNDLE_INCLUDE = {
  translations: true,
  items: { include: { product: { include: { translations: true } } } },
} as const;

export type BundleWithRelations = Prisma.ProductBundleGetPayload<{
  include: typeof BUNDLE_INCLUDE;
}>;

function decimalToString(
  value: Prisma.Decimal | null | undefined,
): string | null {
  return value ? value.toString() : null;
}

export class AdminBundleTranslationDto {
  locale!: Locale;
  name!: string;
  description!: string | null;
}

export class AdminBundleItemDto {
  id!: number;
  productId!: number;
  variantId!: number | null;
  quantity!: number;
}

export class AdminBundleDto {
  id!: number;
  slug!: string;
  bundlePrice!: string | null;
  discountPct!: string | null;
  status!: ContentStatus;
  translations!: AdminBundleTranslationDto[];
  items!: AdminBundleItemDto[];
}

export function toAdminBundleDto(bundle: BundleWithRelations): AdminBundleDto {
  return {
    id: bundle.id,
    slug: bundle.slug,
    bundlePrice: decimalToString(bundle.bundlePrice),
    discountPct: decimalToString(bundle.discountPct),
    status: bundle.status,
    translations: bundle.translations.map((t) => ({
      locale: t.locale,
      name: t.name,
      description: t.description,
    })),
    items: bundle.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      variantId: i.variantId,
      quantity: i.quantity,
    })),
  };
}

export class PublicBundleItemDto {
  productId!: number;
  variantId!: number | null;
  quantity!: number;
  productSlug!: string;
  productName!: string;
}

export class PublicBundleDto {
  id!: number;
  slug!: string;
  bundlePrice!: string | null;
  discountPct!: string | null;
  name!: string;
  description!: string | null;
  items!: PublicBundleItemDto[];
}

export function toPublicBundleDto(
  bundle: BundleWithRelations,
  locale: Locale,
): PublicBundleDto {
  const translation =
    bundle.translations.find((t) => t.locale === locale) ??
    bundle.translations[0];
  return {
    id: bundle.id,
    slug: bundle.slug,
    bundlePrice: decimalToString(bundle.bundlePrice),
    discountPct: decimalToString(bundle.discountPct),
    name: translation?.name ?? bundle.slug,
    description: translation?.description ?? null,
    items: bundle.items.map((i) => {
      const productTranslation =
        i.product.translations.find((t) => t.locale === locale) ??
        i.product.translations[0];
      return {
        productId: i.productId,
        variantId: i.variantId,
        quantity: i.quantity,
        productSlug: i.product.slug,
        productName: productTranslation?.name ?? i.product.slug,
      };
    }),
  };
}

export class PublicBundleDetailDto extends PublicBundleDto {
  seo!: ResolvedSeoDto;
}
