import {
  HomepageSection,
  HomepageSectionTranslation,
  HomepageSectionType,
  Locale,
  Prisma,
} from '@amader/db';
import { PublicCollectionDto } from '../collections/collections.mapper';

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
  collection!: PublicCollectionDto | null;
}

export function toPublicHomepageSectionDto(
  section: HomepageSectionWithTranslations,
  collection: PublicCollectionDto | null,
  locale: Locale,
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
  };
}
