import { BlogTag, BlogTagTranslation, ContentStatus, Locale } from '@amader/db';

type BlogTagWithTranslations = BlogTag & { translations: BlogTagTranslation[] };

export class AdminBlogTagTranslationDto {
  locale!: Locale;
  name!: string;
}

export class AdminBlogTagDto {
  id!: number;
  slug!: string;
  status!: ContentStatus;
  translations!: AdminBlogTagTranslationDto[];
}

export function toAdminBlogTagDto(
  tag: BlogTagWithTranslations,
): AdminBlogTagDto {
  return {
    id: tag.id,
    slug: tag.slug,
    status: tag.status,
    translations: tag.translations.map((t) => ({
      locale: t.locale,
      name: t.name,
    })),
  };
}

export class PublicBlogTagDto {
  id!: number;
  slug!: string;
  name!: string;
}

export function toPublicBlogTagDto(
  tag: BlogTagWithTranslations,
  locale: Locale,
): PublicBlogTagDto {
  const translation =
    tag.translations.find((t) => t.locale === locale) ?? tag.translations[0];
  return { id: tag.id, slug: tag.slug, name: translation?.name ?? tag.slug };
}
