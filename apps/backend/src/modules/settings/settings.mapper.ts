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
  /** Browser-tab icon — see SettingsService.SITE_FAVICON_MEDIA_ID_KEY. Falls
   * back to the storefront's static default (apps/web/public/favicon-default.png)
   * when unset. */
  faviconUrl!: string | null;
  /** Speed of announcement bar marquee ticker in seconds (e.g. 20). */
  announcementSpeedSeconds!: number;
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
  /** Whether the checkout COD flow requires phone OTP verification — see
   * OtpSecuritySettings.codOtpEnabled. Storefront reads this to decide
   * whether to require/show the "Verify your phone" OTP step at all. */
  codOtpEnabled!: boolean;
  /** Site-wide SEO title — used for the homepage's <title>/og:title and as
   * the fallback for any page with no per-page SeoMeta override of its own.
   * Null = storefront falls back to its own hardcoded default. */
  seoTitle!: string | null;
  /** Site-wide SEO description — og:description/meta description fallback,
   * same rule as seoTitle. */
  seoDescription!: string | null;
  /** Open Graph image shown in link-preview cards (WhatsApp, Messenger,
   * Discord, etc.) when this site's homepage/root URL is shared — see
   * SettingsService.SITE_SEO_IMAGE_MEDIA_ID_KEY. Null = no image in the
   * preview card. */
  seoImageUrl!: string | null;
}
