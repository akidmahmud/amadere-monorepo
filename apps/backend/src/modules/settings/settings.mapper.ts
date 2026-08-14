import { Setting } from '@amader/db';

export class SettingDto {
  key!: string;
  value!: unknown;
  updatedAt!: Date;
}

export function toSettingDto(setting: Setting): SettingDto {
  return {
    key: setting.key,
    value: setting.value,
    updatedAt: setting.updatedAt,
  };
}

// Public-safe subset only — never dump every Setting row (some keys are
// secrets, e.g. steadfast_webhook_token).
export class SiteInfoDto {
  siteName!: string;
  logoUrl!: string | null;
  productsPageBannerUrl!: string | null;
  /** Which product card component the storefront renders everywhere a
   * product card appears (homepage, search, PLP, PDP related/cross-sell) —
   * admin-configurable, see SettingsService.PRODUCT_CARD_STYLE_KEY. */
  productCardStyle!: 'ONE' | 'TWO';
  /** Inset space inside the logo's own box, shrinking the visible mark
   * without changing the header slot it sits in — see
   * SettingsService.SITE_LOGO_STYLE_KEY. */
  logoPaddingPx!: number;
  /** Extra space around the logo's box, pushing it away from neighboring
   * header elements — see SettingsService.SITE_LOGO_STYLE_KEY. */
  logoMarginPx!: number;
}
