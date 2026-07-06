import { Brand, BrandTranslation, ContentStatus, Locale } from '@amader/db';
import { ResolvedSeoDto } from '../seo/seo.mapper';

type BrandWithTranslations = Brand & { translations: BrandTranslation[] };

export class AdminBrandTranslationDto {
  locale!: Locale;
  name!: string;
  description!: string | null;
}

export class AdminBrandDto {
  id!: number;
  slug!: string;
  logoUrl!: string | null;
  websiteUrl!: string | null;
  isFeatured!: boolean;
  sortOrder!: number;
  status!: ContentStatus;
  translations!: AdminBrandTranslationDto[];
}

export function toAdminBrandDto(brand: BrandWithTranslations): AdminBrandDto {
  return {
    id: brand.id,
    slug: brand.slug,
    logoUrl: brand.logoUrl,
    websiteUrl: brand.websiteUrl,
    isFeatured: brand.isFeatured,
    sortOrder: brand.sortOrder,
    status: brand.status,
    translations: brand.translations.map((t) => ({
      locale: t.locale,
      name: t.name,
      description: t.description,
    })),
  };
}

export class PublicBrandDto {
  id!: number;
  slug!: string;
  logoUrl!: string | null;
  websiteUrl!: string | null;
  isFeatured!: boolean;
  name!: string;
  description!: string | null;
}

export function toPublicBrandDto(
  brand: BrandWithTranslations,
  locale: Locale,
): PublicBrandDto {
  const translation =
    brand.translations.find((t) => t.locale === locale) ??
    brand.translations[0];
  return {
    id: brand.id,
    slug: brand.slug,
    logoUrl: brand.logoUrl,
    websiteUrl: brand.websiteUrl,
    isFeatured: brand.isFeatured,
    name: translation?.name ?? brand.slug,
    description: translation?.description ?? null,
  };
}

export class PublicBrandDetailDto extends PublicBrandDto {
  seo!: ResolvedSeoDto;
}
