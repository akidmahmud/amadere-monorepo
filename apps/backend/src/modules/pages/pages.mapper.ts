import {
  ContentStatus,
  Locale,
  Page,
  PageKind,
  PageTranslation,
} from '@amader/db';
import { ResolvedSeoDto } from '../seo/seo.mapper';

type PageWithTranslations = Page & { translations: PageTranslation[] };

export class AdminPageTranslationDto {
  locale!: Locale;
  title!: string;
  content!: string;
  // Puck documents. `unknown` rather than a typed shape: these are validated
  // by @amader/page-builder/validate at publish time, and re-declaring the
  // structure here would be a second definition to keep in sync.
  layout!: unknown | null;
  draftLayout!: unknown | null;
}

export class AdminPageDto {
  id!: number;
  slug!: string;
  status!: ContentStatus;
  kind!: PageKind;
  isDefaultCheckout!: boolean;
  translations!: AdminPageTranslationDto[];
}

export function toAdminPageDto(page: PageWithTranslations): AdminPageDto {
  return {
    id: page.id,
    slug: page.slug,
    status: page.status,
    kind: page.kind,
    isDefaultCheckout: page.isDefaultCheckout,
    translations: page.translations.map((t) => ({
      locale: t.locale,
      title: t.title,
      content: t.content,
      layout: t.layout ?? null,
      draftLayout: t.draftLayout ?? null,
    })),
  };
}

export class PublicPageDto {
  id!: number;
  slug!: string;
  title!: string;
  // KEPT alongside `layout`, never replaced by it. The storefront picks:
  // layout when present and valid, else this HTML (plan §5.1). That is what
  // makes every pre-builder page keep working untouched.
  content!: string;
  layout!: unknown | null;
}

export function toPublicPageDto(
  page: PageWithTranslations,
  locale: Locale,
): PublicPageDto {
  const translation =
    page.translations.find((t) => t.locale === locale) ?? page.translations[0];
  return {
    id: page.id,
    slug: page.slug,
    title: translation?.title ?? page.slug,
    content: translation?.content ?? '',
    layout: translation?.layout ?? null,
  };
}

export class PublicPageDetailDto extends PublicPageDto {
  seo!: ResolvedSeoDto;
}
