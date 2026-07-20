import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CredentialsService } from '../../common/credentials/credentials.service';

const KEY_PREFIX = 'analytics.';

export interface Ga4Config {
  enabled: boolean;
  measurementId: string;
  hasApiSecret: boolean;
}
export interface GtmConfig {
  enabled: boolean;
  containerId: string;
}
export interface MetaConfig {
  enabled: boolean;
  pixelId: string;
  testEventCode: string;
  hasAccessToken: boolean;
}
export interface GoogleAdsConfig {
  enabled: boolean;
  conversionId: string;
  conversionLabel: string;
}
export interface TiktokConfig {
  enabled: boolean;
  pixelCode: string;
  hasAccessToken: boolean;
}
export interface ClarityConfig {
  enabled: boolean;
  projectId: string;
}
export interface UtmConfig {
  enabled: boolean;
}

export interface PublicAnalyticsConfig {
  ga4: { measurementId: string } | null;
  gtm: { containerId: string } | null;
  meta: { pixelId: string } | null;
  googleAds: { conversionId: string; conversionLabel: string | null } | null;
  tiktok: { pixelCode: string } | null;
  clarity: { projectId: string } | null;
  utmEnabled: boolean;
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
  testEventCode: string;
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

const GA4_DEFAULTS: Ga4Json = { enabled: false, measurementId: '' };
const GTM_DEFAULTS: GtmJson = { enabled: false, containerId: '' };
const META_DEFAULTS: MetaJson = { enabled: false, pixelId: '', testEventCode: '' };
const GOOGLE_ADS_DEFAULTS: GoogleAdsJson = { enabled: false, conversionId: '', conversionLabel: '' };
const TIKTOK_DEFAULTS: TiktokJson = { enabled: false, pixelCode: '' };
const CLARITY_DEFAULTS: ClarityJson = { enabled: false, projectId: '' };
const UTM_DEFAULTS: UtmJson = { enabled: true };

// Credential/config storage for the tracking pixels (GA4/GTM/Meta/Google
// Ads/TikTok/Clarity) plus the UTM-capture toggle — same split as
// CourierSettingsService: non-secret fields (IDs, toggles) live in the
// generic `Setting` table, secrets (API/access tokens) go through
// CredentialsService (encrypted at rest). This is the sole source of truth
// for the server-side providers (Ga4Provider/MetaCapiProvider/
// TiktokEventsProvider) and for the public /analytics/config endpoint the
// storefront's script loader reads — no `.env` fallback, matching the
// courier providers' DB-only pattern.
@Injectable()
export class AnalyticsSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: CredentialsService,
  ) {}

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
    const json = await this.getJson('ga4', GA4_DEFAULTS);
    const hasApiSecret = await this.credentials.hasCredential('analytics.ga4.apiSecret');
    return { ...json, hasApiSecret };
  }

  async updateGa4Config(input: { enabled?: boolean; measurementId?: string; apiSecret?: string }): Promise<Ga4Config> {
    const current = await this.getJson('ga4', GA4_DEFAULTS);
    await this.setJson('ga4', {
      enabled: input.enabled ?? current.enabled,
      measurementId: input.measurementId ?? current.measurementId,
    });
    await this.credentials.saveCredential('analytics.ga4.apiSecret', input.apiSecret);
    return this.getGa4Config();
  }

  async getGa4Credentials(): Promise<{ enabled: boolean; measurementId: string; apiSecret: string | null }> {
    const json = await this.getJson('ga4', GA4_DEFAULTS);
    const apiSecret = await this.credentials.getCredential('analytics.ga4.apiSecret');
    return { enabled: json.enabled, measurementId: json.measurementId, apiSecret };
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
    const json = await this.getJson('meta', META_DEFAULTS);
    const hasAccessToken = await this.credentials.hasCredential('analytics.meta.accessToken');
    return { ...json, hasAccessToken };
  }

  async updateMetaConfig(input: {
    enabled?: boolean;
    pixelId?: string;
    testEventCode?: string;
    accessToken?: string;
  }): Promise<MetaConfig> {
    const current = await this.getJson('meta', META_DEFAULTS);
    await this.setJson('meta', {
      enabled: input.enabled ?? current.enabled,
      pixelId: input.pixelId ?? current.pixelId,
      testEventCode: input.testEventCode ?? current.testEventCode,
    });
    await this.credentials.saveCredential('analytics.meta.accessToken', input.accessToken);
    return this.getMetaConfig();
  }

  async getMetaCredentials(): Promise<{ enabled: boolean; pixelId: string; accessToken: string | null }> {
    const json = await this.getJson('meta', META_DEFAULTS);
    const accessToken = await this.credentials.getCredential('analytics.meta.accessToken');
    return { enabled: json.enabled, pixelId: json.pixelId, accessToken };
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
    const json = await this.getJson('tiktok', TIKTOK_DEFAULTS);
    const hasAccessToken = await this.credentials.hasCredential('analytics.tiktok.accessToken');
    return { ...json, hasAccessToken };
  }

  async updateTiktokConfig(input: { enabled?: boolean; pixelCode?: string; accessToken?: string }): Promise<TiktokConfig> {
    const current = await this.getJson('tiktok', TIKTOK_DEFAULTS);
    await this.setJson('tiktok', {
      enabled: input.enabled ?? current.enabled,
      pixelCode: input.pixelCode ?? current.pixelCode,
    });
    await this.credentials.saveCredential('analytics.tiktok.accessToken', input.accessToken);
    return this.getTiktokConfig();
  }

  async getTiktokCredentials(): Promise<{ enabled: boolean; pixelCode: string; accessToken: string | null }> {
    const json = await this.getJson('tiktok', TIKTOK_DEFAULTS);
    const accessToken = await this.credentials.getCredential('analytics.tiktok.accessToken');
    return { enabled: json.enabled, pixelCode: json.pixelCode, accessToken };
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

  // Client-safe subset for the storefront's script loader — never secrets,
  // and only for providers that are both enabled and have their public ID
  // actually set (so a half-configured provider never injects a broken tag).
  async getPublicConfig(): Promise<PublicAnalyticsConfig> {
    const [ga4, gtm, meta, googleAds, tiktok, clarity, utm] = await Promise.all([
      this.getJson('ga4', GA4_DEFAULTS),
      this.getJson('gtm', GTM_DEFAULTS),
      this.getJson('meta', META_DEFAULTS),
      this.getJson('google_ads', GOOGLE_ADS_DEFAULTS),
      this.getJson('tiktok', TIKTOK_DEFAULTS),
      this.getJson('clarity', CLARITY_DEFAULTS),
      this.getJson('utm', UTM_DEFAULTS),
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
    };
  }
}
