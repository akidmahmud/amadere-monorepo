import {
  BlogCategory,
  BlogCategoryTranslation,
  ContentStatus,
  Locale,
} from '@amader/db';
import { ResolvedSeoDto } from '../seo/seo.mapper';

type BlogCategoryWithTranslations = BlogCategory & {
  translations: BlogCategoryTranslation[];
};

export class AdminBlogCategoryTranslationDto {
  locale!: Locale;
  name!: string;
  description!: string | null;
}

export class AdminBlogCategoryDto {
  id!: number;
  slug!: string;
  parentId!: number | null;
  sortOrder!: number;
  status!: ContentStatus;
  translations!: AdminBlogCategoryTranslationDto[];
}

export function toAdminBlogCategoryDto(
  category: BlogCategoryWithTranslations,
): AdminBlogCategoryDto {
  return {
    id: category.id,
    slug: category.slug,
    parentId: category.parentId,
    sortOrder: category.sortOrder,
    status: category.status,
    translations: category.translations.map((t) => ({
      locale: t.locale,
      name: t.name,
      description: t.description,
    })),
  };
}

export class PublicBlogCategoryDto {
  id!: number;
  slug!: string;
  parentId!: number | null;
  name!: string;
  description!: string | null;
}

export function toPublicBlogCategoryDto(
  category: BlogCategoryWithTranslations,
  locale: Locale,
): PublicBlogCategoryDto {
  const translation =
    category.translations.find((t) => t.locale === locale) ??
    category.translations[0];
  return {
    id: category.id,
    slug: category.slug,
    parentId: category.parentId,
    name: translation?.name ?? category.slug,
    description: translation?.description ?? null,
  };
}

export class PublicBlogCategoryDetailDto extends PublicBlogCategoryDto {
  seo!: ResolvedSeoDto;
}
