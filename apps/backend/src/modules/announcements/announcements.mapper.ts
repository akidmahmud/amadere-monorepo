import { Announcement, AnnouncementTranslation, Locale } from '@amader/db';

type AnnouncementWithTranslations = Announcement & {
  translations: AnnouncementTranslation[];
};

export class AdminAnnouncementTranslationDto {
  locale!: Locale;
  message!: string;
}

export class AdminAnnouncementDto {
  id!: number;
  linkUrl!: string | null;
  sortOrder!: number;
  isActive!: boolean;
  translations!: AdminAnnouncementTranslationDto[];
}

export function toAdminAnnouncementDto(
  announcement: AnnouncementWithTranslations,
): AdminAnnouncementDto {
  return {
    id: announcement.id,
    linkUrl: announcement.linkUrl,
    sortOrder: announcement.sortOrder,
    isActive: announcement.isActive,
    translations: announcement.translations.map((t) => ({
      locale: t.locale,
      message: t.message,
    })),
  };
}

function resolveTranslation<T extends { locale: Locale }>(
  translations: T[],
  locale: Locale,
): T | undefined {
  return translations.find((t) => t.locale === locale) ?? translations[0];
}

export class PublicAnnouncementDto {
  id!: number;
  message!: string;
  linkUrl!: string | null;
}

export function toPublicAnnouncementDto(
  announcement: AnnouncementWithTranslations,
  locale: Locale,
): PublicAnnouncementDto {
  const translation = resolveTranslation(announcement.translations, locale);
  return {
    id: announcement.id,
    message: translation?.message ?? '',
    linkUrl: announcement.linkUrl,
  };
}
