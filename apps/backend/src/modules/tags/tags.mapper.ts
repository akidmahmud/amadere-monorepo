import { ContentStatus, Locale, Tag, TagTranslation } from '@amader/db';
import { ResolvedSeoDto } from '../seo/seo.mapper';

type TagWithTranslations = Tag & { translations: TagTranslation[] };

export class AdminTagTranslationDto {
  locale!: Locale;
  name!: string;
  description!: string | null;
}

export class AdminTagDto {
  id!: number;
  slug!: string;
  status!: ContentStatus;
  translations!: AdminTagTranslationDto[];
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

export class PublicTagDto {
  id!: number;
  slug!: string;
  name!: string;
  description!: string | null;
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

export class PublicTagDetailDto extends PublicTagDto {
  seo!: ResolvedSeoDto;
}
