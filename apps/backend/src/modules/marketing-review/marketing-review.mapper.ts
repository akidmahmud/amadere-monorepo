import { MarketingReviewCard, MarketingReviewCardTranslation, Locale } from '@amader/db';

type CardWithTranslations = MarketingReviewCard & {
  translations: MarketingReviewCardTranslation[];
};

export class AdminMarketingReviewCardTranslationDto {
  locale!: Locale;
  caption!: string | null;
}

export class AdminMarketingReviewCardDto {
  id!: number;
  imageUrl!: string;
  sortOrder!: number;
  isActive!: boolean;
  translations!: AdminMarketingReviewCardTranslationDto[];
}

export function toAdminMarketingReviewCardDto(
  card: CardWithTranslations,
): AdminMarketingReviewCardDto {
  return {
    id: card.id,
    imageUrl: card.imageUrl,
    sortOrder: card.sortOrder,
    isActive: card.isActive,
    translations: card.translations.map((t) => ({
      locale: t.locale,
      caption: t.caption,
    })),
  };
}

function resolveTranslation<T extends { locale: Locale }>(
  translations: T[],
  locale: Locale,
): T | undefined {
  return translations.find((t) => t.locale === locale) ?? translations[0];
}

export class PublicMarketingReviewCardDto {
  id!: number;
  imageUrl!: string;
  caption!: string | null;
}

export function toPublicMarketingReviewCardDto(
  card: CardWithTranslations,
  locale: Locale,
): PublicMarketingReviewCardDto {
  const translation = resolveTranslation(card.translations, locale);
  return {
    id: card.id,
    imageUrl: card.imageUrl,
    caption: translation?.caption ?? null,
  };
}
