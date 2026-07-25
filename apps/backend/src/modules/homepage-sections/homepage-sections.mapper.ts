import {
  HomepageSection,
  HomepageSectionTranslation,
  HomepageSectionType,
  Locale,
  Prisma,
} from '@amader/db';
import { PublicCollectionDto } from '../collections/collections.mapper';
import { PublicProductDto } from '../products/dto/product-response.dto';

type HomepageSectionWithTranslations = HomepageSection & {
  translations: HomepageSectionTranslation[];
};

export class AdminHomepageSectionTranslationDto {
  locale!: Locale;
  heading!: string | null;
  subheading!: string | null;
}

export class AdminHomepageSectionDto {
  id!: number;
  type!: HomepageSectionType;
  sortOrder!: number;
  isActive!: boolean;
  config!: Prisma.JsonValue;
  collectionId!: number | null;
  translations!: AdminHomepageSectionTranslationDto[];
}

export function toAdminHomepageSectionDto(
  section: HomepageSectionWithTranslations,
): AdminHomepageSectionDto {
  return {
    id: section.id,
    type: section.type,
    sortOrder: section.sortOrder,
    isActive: section.isActive,
    config: section.config,
    collectionId: section.collectionId,
    translations: section.translations.map((t) => ({
      locale: t.locale,
      heading: t.heading,
      subheading: t.subheading,
    })),
  };
}

export class PublicHomepageSectionDto {
  id!: number;
  type!: HomepageSectionType;
  sortOrder!: number;
  heading!: string | null;
  subheading!: string | null;
  config!: Prisma.JsonValue;
  /** PRODUCT_COLLECTION and TABBED_COLLECTION_CAROUSEL only — resolved via
   * the shared collectionId FK (TABBED_COLLECTION_CAROUSEL used to store
   * per-tab collectionIds in config.tabs; it's now a single-collection
   * strip, no tabs, using this same field). */
  collection!: PublicCollectionDto | null;
  /** PROMO_VIDEO only — one resolved product per config.videos entry, same
   * order/length, null for a video with no productId or whose product no
   * longer resolves (deleted/unpublished) rather than dropping the video. */
  promoVideoProducts!: (PublicProductDto | null)[] | null;
  /** TOP_SELLING_PRODUCTS only — one resolved product per config.items
   * entry, same order/length, null for an item whose product no longer
   * resolves (deleted/unpublished) rather than dropping the item silently. */
  topSellingProducts!: (PublicProductDto | null)[] | null;
}

export function toPublicHomepageSectionDto(
  section: HomepageSectionWithTranslations,
  collection: PublicCollectionDto | null,
  locale: Locale,
  promoVideoProducts: (PublicProductDto | null)[] | null = null,
  topSellingProducts: (PublicProductDto | null)[] | null = null,
): PublicHomepageSectionDto {
  const translation =
    section.translations.find((t) => t.locale === locale) ??
    section.translations[0];
  return {
    id: section.id,
    type: section.type,
    sortOrder: section.sortOrder,
    heading: translation?.heading ?? null,
    subheading: translation?.subheading ?? null,
    config: section.config,
    collection,
    promoVideoProducts,
    topSellingProducts,
  };
}
