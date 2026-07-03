import { ContentStatus, Locale, Tag, TagTranslation } from '@amader/db';

type TagWithTranslations = Tag & { translations: TagTranslation[] };

export interface AdminTagDto {
  id: number;
  slug: string;
  status: ContentStatus;
  translations: { locale: Locale; name: string; description: string | null }[];
}

export function toAdminTagDto(tag: TagWithTranslations): AdminTagDto {
  return {
    id: tag.id,
    slug: tag.slug,
    status: tag.status,
    translations: tag.translations.map((t) => ({
      locale: t.locale,
      name: t.name,
      description: t.description,
    })),
  };
}

export interface PublicTagDto {
  id: number;
  slug: string;
  name: string;
  description: string | null;
}

export function toPublicTagDto(
  tag: TagWithTranslations,
  locale: Locale,
): PublicTagDto {
  const translation =
    tag.translations.find((t) => t.locale === locale) ?? tag.translations[0];
  return {
    id: tag.id,
    slug: tag.slug,
    name: translation?.name ?? tag.slug,
    description: translation?.description ?? null,
  };
}
