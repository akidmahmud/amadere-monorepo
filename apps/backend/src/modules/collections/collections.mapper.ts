import { Collection, CollectionTranslation, ContentStatus, Locale } from '@amader/db';
import { PublicProductDto } from '../products/dto/product-response.dto';
import { ResolvedSeoDto } from '../seo/seo.mapper';

type CollectionWithTranslations = Collection & {
  translations: CollectionTranslation[];
  products: { productId: number; sortOrder: number }[];
};

export class AdminCollectionProductDto {
  productId!: number;
  sortOrder!: number;
}

export class AdminCollectionTranslationDto {
  locale!: Locale;
  name!: string;
  description!: string | null;
}

export class AdminCollectionDto {
  id!: number;
  slug!: string;
  status!: ContentStatus;
  sortOrder!: number;
  showInNav!: boolean;
  translations!: AdminCollectionTranslationDto[];
  products!: AdminCollectionProductDto[];
}

export function toAdminCollectionDto(
  collection: CollectionWithTranslations,
): AdminCollectionDto {
  return {
    id: collection.id,
    slug: collection.slug,
    status: collection.status,
    sortOrder: collection.sortOrder,
    showInNav: collection.showInNav,
    translations: collection.translations.map((t) => ({
      locale: t.locale,
      name: t.name,
      description: t.description,
    })),
    products: collection.products.map((p) => ({
      productId: p.productId,
      sortOrder: p.sortOrder,
    })),
  };
}

export class PublicCollectionSummaryDto {
  id!: number;
  slug!: string;
  name!: string;
  description!: string | null;
}

function toPublicCollectionSummaryDto(
  collection: CollectionWithTranslations,
  locale: Locale,
): PublicCollectionSummaryDto {
  const translation =
    collection.translations.find((t) => t.locale === locale) ??
    collection.translations[0];
  return {
    id: collection.id,
    slug: collection.slug,
    name: translation?.name ?? collection.slug,
    description: translation?.description ?? null,
  };
}

export class PublicCollectionDto extends PublicCollectionSummaryDto {
  products!: PublicProductDto[];
}

export function toPublicCollectionDto(
  collection: CollectionWithTranslations,
  products: PublicProductDto[],
  locale: Locale,
): PublicCollectionDto {
  return { ...toPublicCollectionSummaryDto(collection, locale), products };
}

export class PublicCollectionDetailDto extends PublicCollectionDto {
  seo!: ResolvedSeoDto;
}

export class PublicNavCollectionDto {
  slug!: string;
  name!: string;
}

export function toPublicNavCollectionDto(
  collection: CollectionWithTranslations,
  locale: Locale,
): PublicNavCollectionDto {
  const translation =
    collection.translations.find((t) => t.locale === locale) ??
    collection.translations[0];
  return { slug: collection.slug, name: translation?.name ?? collection.slug };
}
