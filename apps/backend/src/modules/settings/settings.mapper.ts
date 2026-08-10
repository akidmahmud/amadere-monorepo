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
  /** Which product card component the storefront renders everywhere a
   * product card appears (homepage, search, PLP, PDP related/cross-sell) —
   * admin-configurable, see SettingsService.PRODUCT_CARD_STYLE_KEY. */
  productCardStyle!: 'ONE' | 'TWO';
}
