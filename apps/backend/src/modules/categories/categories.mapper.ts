import {
  Category,
  CategoryTranslation,
  ContentStatus,
  Locale,
} from '@amader/db';
import { ResolvedSeoDto } from '../seo/seo.mapper';

type CategoryWithTranslations = Category & {
  translations: CategoryTranslation[];
  _count?: { products: number };
};

export class AdminCategoryTranslationDto {
  locale!: Locale;
  name!: string;
  description!: string | null;
}

export class AdminCategoryDto {
  id!: number;
  slug!: string;
  parentId!: number | null;
  imageUrl!: string | null;
  iconUrl!: string | null;
  isFeatured!: boolean;
  sortOrder!: number;
  status!: ContentStatus;
  translations!: AdminCategoryTranslationDto[];
  /** Only populated when the query requested it (see WITH_TRANSLATIONS_AND_ADMIN_PRODUCT_COUNT). */
  productCount?: number;
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
    productCount: category._count?.products,
  };
}

export class PublicCategoryDto {
  id!: number;
  slug!: string;
  parentId!: number | null;
  imageUrl!: string | null;
  iconUrl!: string | null;
  isFeatured!: boolean;
  name!: string;
  description!: string | null;
  productCount!: number;
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
    productCount: category._count?.products ?? 0,
  };
}

export class PublicCategoryDetailDto extends PublicCategoryDto {
  seo!: ResolvedSeoDto;
}
