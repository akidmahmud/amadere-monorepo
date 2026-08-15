import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

const KEY_PREFIX = 'analytics.';

export interface Ga4Config {
  enabled: boolean;
  measurementId: string;
}
export interface GtmConfig {
  enabled: boolean;
  containerId: string;
}
export interface MetaConfig {
  enabled: boolean;
  pixelId: string;
}
export interface GoogleAdsConfig {
  enabled: boolean;
  conversionId: string;
  conversionLabel: string;
}
export interface TiktokConfig {
  enabled: boolean;
  pixelCode: string;
}
export interface ClarityConfig {
  enabled: boolean;
  projectId: string;
}
export interface UtmConfig {
  enabled: boolean;
}
export interface CustomScriptConfig {
  enabled: boolean;
  headerScript: string;
  bodyScript: string;
}

export interface PublicAnalyticsConfig {
  ga4: { measurementId: string } | null;
  gtm: { containerId: string } | null;
  meta: { pixelId: string } | null;
  googleAds: { conversionId: string; conversionLabel: string | null } | null;
  tiktok: { pixelCode: string } | null;
  clarity: { projectId: string } | null;
  utmEnabled: boolean;
  customScript: { headerScript: string; bodyScript: string } | null;
}

interface Ga4Json {
  enabled: boolean;
  measurementId: string;
}
interface GtmJson {
  enabled: boolean;
  containerId: string;
}
interface MetaJson {
  enabled: boolean;
  pixelId: string;
}
interface GoogleAdsJson {
  enabled: boolean;
  conversionId: string;
  conversionLabel: string;
}
interface TiktokJson {
  enabled: boolean;
  pixelCode: string;
}
interface ClarityJson {
  enabled: boolean;
  projectId: string;
}
interface UtmJson {
  enabled: boolean;
}
interface CustomScriptJson {
  enabled: boolean;
  headerScript: string;
  bodyScript: string;
}

const GA4_DEFAULTS: Ga4Json = { enabled: false, measurementId: '' };
const GTM_DEFAULTS: GtmJson = { enabled: false, containerId: '' };
const META_DEFAULTS: MetaJson = { enabled: false, pixelId: '' };
const GOOGLE_ADS_DEFAULTS: GoogleAdsJson = { enabled: false, conversionId: '', conversionLabel: '' };
const TIKTOK_DEFAULTS: TiktokJson = { enabled: false, pixelCode: '' };
const CLARITY_DEFAULTS: ClarityJson = { enabled: false, projectId: '' };
const UTM_DEFAULTS: UtmJson = { enabled: true };
const CUSTOM_SCRIPT_DEFAULTS: CustomScriptJson = { enabled: false, headerScript: '', bodyScript: '' };

// Config storage for the client-side tracking pixels (GA4/GTM/Meta/Google
// Ads/TikTok/Clarity) plus the UTM-capture toggle — all plain, non-secret
// IDs, since every one of these now only feeds the storefront's own
// script loader (AnalyticsScripts, via getPublicConfig below) and the admin
// settings UI. No server-side forwarding (GA4 Measurement Protocol / Meta
// CAPI / TikTok Events API) happens from this backend — that's handled by
// server-side GTM instead, so there's nothing here that needs a secret kept
// server-only.
@Injectable()
export class AnalyticsSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getJson<T>(key: string, defaults: T): Promise<T> {
    const row = await this.prisma.client.setting.findUnique({ where: { key: KEY_PREFIX + key } });
    return row ? { ...defaults, ...(row.value as object) } : defaults;
  }

  private async setJson(key: string, value: object): Promise<void> {
    await this.prisma.client.setting.upsert({
      where: { key: KEY_PREFIX + key },
      create: { key: KEY_PREFIX + key, value: value as never },
      update: { value: value as never },
    });
  }

  async getGa4Config(): Promise<Ga4Config> {
    return this.getJson('ga4', GA4_DEFAULTS);
  }

  async updateGa4Config(input: Partial<Ga4Json>): Promise<Ga4Config> {
    const current = await this.getJson('ga4', GA4_DEFAULTS);
    const next = { enabled: input.enabled ?? current.enabled, measurementId: input.measurementId ?? current.measurementId };
    await this.setJson('ga4', next);
    return next;
  }

  async getGtmConfig(): Promise<GtmConfig> {
    return this.getJson('gtm', GTM_DEFAULTS);
  }

  async updateGtmConfig(input: Partial<GtmJson>): Promise<GtmConfig> {
    const current = await this.getJson('gtm', GTM_DEFAULTS);
    const next = { enabled: input.enabled ?? current.enabled, containerId: input.containerId ?? current.containerId };
    await this.setJson('gtm', next);
    return next;
  }

  async getMetaConfig(): Promise<MetaConfig> {
    return this.getJson('meta', META_DEFAULTS);
  }

  async updateMetaConfig(input: Partial<MetaJson>): Promise<MetaConfig> {
    const current = await this.getJson('meta', META_DEFAULTS);
    const next = { enabled: input.enabled ?? current.enabled, pixelId: input.pixelId ?? current.pixelId };
    await this.setJson('meta', next);
    return next;
  }

  async getGoogleAdsConfig(): Promise<GoogleAdsConfig> {
    return this.getJson('google_ads', GOOGLE_ADS_DEFAULTS);
  }

  async updateGoogleAdsConfig(input: Partial<GoogleAdsJson>): Promise<GoogleAdsConfig> {
    const current = await this.getJson('google_ads', GOOGLE_ADS_DEFAULTS);
    const next = {
      enabled: input.enabled ?? current.enabled,
      conversionId: input.conversionId ?? current.conversionId,
      conversionLabel: input.conversionLabel ?? current.conversionLabel,
    };
    await this.setJson('google_ads', next);
    return next;
  }

  async getTiktokConfig(): Promise<TiktokConfig> {
    return this.getJson('tiktok', TIKTOK_DEFAULTS);
  }

  async updateTiktokConfig(input: Partial<TiktokJson>): Promise<TiktokConfig> {
    const current = await this.getJson('tiktok', TIKTOK_DEFAULTS);
    const next = { enabled: input.enabled ?? current.enabled, pixelCode: input.pixelCode ?? current.pixelCode };
    await this.setJson('tiktok', next);
    return next;
  }

  async getClarityConfig(): Promise<ClarityConfig> {
    return this.getJson('clarity', CLARITY_DEFAULTS);
  }

  async updateClarityConfig(input: Partial<ClarityJson>): Promise<ClarityConfig> {
    const current = await this.getJson('clarity', CLARITY_DEFAULTS);
    const next = { enabled: input.enabled ?? current.enabled, projectId: input.projectId ?? current.projectId };
    await this.setJson('clarity', next);
    return next;
  }

  async getUtmConfig(): Promise<UtmConfig> {
    return this.getJson('utm', UTM_DEFAULTS);
  }

  async updateUtmConfig(input: Partial<UtmJson>): Promise<UtmConfig> {
    const current = await this.getJson('utm', UTM_DEFAULTS);
    const next = { enabled: input.enabled ?? current.enabled };
    await this.setJson('utm', next);
    return next;
  }

  // Raw <head>/<body> tracking snippets for services we don't have a
  // dedicated provider for (Matomo, Plausible, Fathom, etc.) — same escape
  // hatch as the reference site's "Custom Tracking Code" mode, additive to
  // our other providers rather than mutually exclusive with them.
  async getCustomScriptConfig(): Promise<CustomScriptConfig> {
    return this.getJson('custom_script', CUSTOM_SCRIPT_DEFAULTS);
  }

  async updateCustomScriptConfig(input: Partial<CustomScriptJson>): Promise<CustomScriptConfig> {
    const current = await this.getJson('custom_script', CUSTOM_SCRIPT_DEFAULTS);
    const next = {
      enabled: input.enabled ?? current.enabled,
      headerScript: input.headerScript ?? current.headerScript,
      bodyScript: input.bodyScript ?? current.bodyScript,
    };
    await this.setJson('custom_script', next);
    return next;
  }

  // Client-safe subset for the storefront's script loader — only for
  // providers that are both enabled and have their public ID actually set
  // (so a half-configured provider never injects a broken tag).
  async getPublicConfig(): Promise<PublicAnalyticsConfig> {
    const [ga4, gtm, meta, googleAds, tiktok, clarity, utm, customScript] = await Promise.all([
      this.getJson('ga4', GA4_DEFAULTS),
      this.getJson('gtm', GTM_DEFAULTS),
      this.getJson('meta', META_DEFAULTS),
      this.getJson('google_ads', GOOGLE_ADS_DEFAULTS),
      this.getJson('tiktok', TIKTOK_DEFAULTS),
      this.getJson('clarity', CLARITY_DEFAULTS),
      this.getJson('utm', UTM_DEFAULTS),
      this.getJson('custom_script', CUSTOM_SCRIPT_DEFAULTS),
    ]);
    return {
      ga4: ga4.enabled && ga4.measurementId ? { measurementId: ga4.measurementId } : null,
      gtm: gtm.enabled && gtm.containerId ? { containerId: gtm.containerId } : null,
      meta: meta.enabled && meta.pixelId ? { pixelId: meta.pixelId } : null,
      googleAds:
        googleAds.enabled && googleAds.conversionId
          ? { conversionId: googleAds.conversionId, conversionLabel: googleAds.conversionLabel || null }
          : null,
      tiktok: tiktok.enabled && tiktok.pixelCode ? { pixelCode: tiktok.pixelCode } : null,
      clarity: clarity.enabled && clarity.projectId ? { projectId: clarity.projectId } : null,
      utmEnabled: utm.enabled,
      customScript:
        customScript.enabled && customScript.headerScript
          ? { headerScript: customScript.headerScript, bodyScript: customScript.bodyScript }
          : null,
    };
  }
}
