import { Locale, MenuItem, MenuItemTranslation } from '@amader/db';

type MenuItemWithTranslations = MenuItem & {
  translations: MenuItemTranslation[];
};
// Nav menus are two levels deep (top item + dropdown children) — matches the
// prototype's nav (flat items, some with a dropdown chevron).
type MenuItemWithChildren = MenuItemWithTranslations & {
  children: MenuItemWithTranslations[];
};

export class AdminMenuItemTranslationDto {
  locale!: Locale;
  label!: string;
}

export class AdminMenuItemDto {
  id!: number;
  parentId!: number | null;
  href!: string;
  sortOrder!: number;
  isActive!: boolean;
  translations!: AdminMenuItemTranslationDto[];
}

export function toAdminMenuItemDto(
  item: MenuItemWithTranslations,
): AdminMenuItemDto {
  return {
    id: item.id,
    parentId: item.parentId,
    href: item.href,
    sortOrder: item.sortOrder,
    isActive: item.isActive,
    translations: item.translations.map((t) => ({
      locale: t.locale,
      label: t.label,
    })),
  };
}

function resolveTranslation<T extends { locale: Locale }>(
  translations: T[],
  locale: Locale,
): T | undefined {
  return translations.find((t) => t.locale === locale) ?? translations[0];
}

export class PublicMenuItemDto {
  id!: number;
  label!: string;
  href!: string;
  children!: PublicMenuItemDto[];
}

function toLeafMenuItemDto(
  item: MenuItemWithTranslations,
  locale: Locale,
): PublicMenuItemDto {
  const translation = resolveTranslation(item.translations, locale);
  return {
    id: item.id,
    label: translation?.label ?? item.href,
    href: item.href,
    children: [],
  };
}

export function toPublicMenuItemDto(
  item: MenuItemWithChildren,
  locale: Locale,
): PublicMenuItemDto {
  return {
    ...toLeafMenuItemDto(item, locale),
    children: item.children
      .filter((c) => c.isActive)
      .map((c) => toLeafMenuItemDto(c, locale)),
  };
}
