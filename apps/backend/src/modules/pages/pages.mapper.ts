import { ContentStatus, Locale, Page, PageTranslation } from '@amader/db';

type PageWithTranslations = Page & { translations: PageTranslation[] };

export interface AdminPageDto {
  id: number;
  slug: string;
  status: ContentStatus;
  translations: { locale: Locale; title: string; content: string }[];
}

export function toAdminPageDto(page: PageWithTranslations): AdminPageDto {
  return {
    id: page.id,
    slug: page.slug,
    status: page.status,
    translations: page.translations.map((t) => ({
      locale: t.locale,
      title: t.title,
      content: t.content,
    })),
  };
}

export interface PublicPageDto {
  id: number;
  slug: string;
  title: string;
  content: string;
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
  };
}
