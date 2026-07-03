import {
  Category,
  CategoryTranslation,
  ContentStatus,
  Locale,
} from '@amader/db';

type CategoryWithTranslations = Category & {
  translations: CategoryTranslation[];
};

export interface AdminCategoryDto {
  id: number;
  slug: string;
  parentId: number | null;
  imageUrl: string | null;
  iconUrl: string | null;
  isFeatured: boolean;
  sortOrder: number;
  status: ContentStatus;
  translations: { locale: Locale; name: string; description: string | null }[];
}

export function toAdminCategoryDto(
  category: CategoryWithTranslations,
): AdminCategoryDto {
  return {
    id: category.id,
    slug: category.slug,
    parentId: category.parentId,
    imageUrl: category.imageUrl,
    iconUrl: category.iconUrl,
    isFeatured: category.isFeatured,
    sortOrder: category.sortOrder,
    status: category.status,
    translations: category.translations.map((t) => ({
      locale: t.locale,
      name: t.name,
      description: t.description,
    })),
  };
}

export interface PublicCategoryDto {
  id: number;
  slug: string;
  parentId: number | null;
  imageUrl: string | null;
  iconUrl: string | null;
  isFeatured: boolean;
  name: string;
  description: string | null;
}

export function toPublicCategoryDto(
  category: CategoryWithTranslations,
  locale: Locale,
): PublicCategoryDto {
  const translation =
    category.translations.find((t) => t.locale === locale) ??
    category.translations[0];
  return {
    id: category.id,
    slug: category.slug,
    parentId: category.parentId,
    imageUrl: category.imageUrl,
    iconUrl: category.iconUrl,
    isFeatured: category.isFeatured,
    name: translation?.name ?? category.slug,
    description: translation?.description ?? null,
  };
}
