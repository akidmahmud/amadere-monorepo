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
  /** Present only on the admin detail read, which includes the join rows so
   *  the edit form can pre-select the category's products. */
  products?: { productId: number }[];
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
  bannerImageUrl!: string | null;
  isFeatured!: boolean;
  sortOrder!: number;
  status!: ContentStatus;
  translations!: AdminCategoryTranslationDto[];
  /** Only populated when the query requested it (see WITH_TRANSLATIONS_AND_ADMIN_PRODUCT_COUNT). */
  productCount?: number;
  /** The category's current products, for the edit form to pre-select.
   *  Only on the detail read — the list does not carry them. */
  productIds?: number[];
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
    bannerImageUrl: category.bannerImageUrl,
    isFeatured: category.isFeatured,
    sortOrder: category.sortOrder,
    status: category.status,
    translations: category.translations.map((t) => ({
      locale: t.locale,
      name: t.name,
      description: t.description,
    })),
    productCount: category._count?.products,
    productIds: Array.isArray(category.products)
      ? category.products.map((p) => p.productId)
      : undefined,
  };
}

export class PublicCategoryDto {
  id!: number;
  slug!: string;
  parentId!: number | null;
  imageUrl!: string | null;
  iconUrl!: string | null;
  bannerImageUrl!: string | null;
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
    bannerImageUrl: category.bannerImageUrl,
    isFeatured: category.isFeatured,
    name: translation?.name ?? category.slug,
    description: translation?.description ?? null,
    productCount: category._count?.products ?? 0,
  };
}

export class PublicCategoryDetailDto extends PublicCategoryDto {
  seo!: ResolvedSeoDto;
}

export class PublicCategoryNavChildDto {
  id!: number;
  slug!: string;
  name!: string;
}

export class PublicCategoryNavDto {
  id!: number;
  slug!: string;
  name!: string;
  children!: PublicCategoryNavChildDto[];
}

type CategoryWithTranslationsAndChildren = CategoryWithTranslations & {
  children: CategoryWithTranslations[];
};

function nameFor(category: CategoryWithTranslations, locale: Locale): string {
  const translation =
    category.translations.find((t) => t.locale === locale) ??
    category.translations[0];
  return translation?.name ?? category.slug;
}

export function toPublicCategoryNavDto(
  category: CategoryWithTranslationsAndChildren,
  locale: Locale,
): PublicCategoryNavDto {
  return {
    id: category.id,
    slug: category.slug,
    name: nameFor(category, locale),
    children: category.children.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: nameFor(c, locale),
    })),
  };
}
