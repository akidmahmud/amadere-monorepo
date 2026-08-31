import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CredentialsService } from '../../../common/credentials/credentials.service';

const SETTING_KEY = 'payment.bkash';

// Display/behaviour fields — safe to read back to the admin UI verbatim.
export interface BkashSettingsJson {
  isActive: boolean;
  liveMode: boolean;
  methodNameEn: string;
  methodNameBn: string;
  descriptionEn: string;
  descriptionBn: string;
  logoUrl: string;
}

// What the admin screen gets: the JSON above plus has-it/haven't-got-it flags
// for each secret. The secrets themselves are never sent back — same masked
// contract CourierSettingsService uses for the Steadfast keys.
export interface BkashConfig extends BkashSettingsJson {
  hasUsername: boolean;
  hasPassword: boolean;
  hasAppKey: boolean;
  hasAppSecretKey: boolean;
  isConfigured: boolean;
}

export interface PublicBkashConfig {
  methodNameEn: string;
  methodNameBn: string;
  descriptionEn: string;
  descriptionBn: string;
  logoUrl: string;
}

export interface BkashCredentials {
  username: string;
  password: string;
  appKey: string;
  appSecretKey: string;
}

const DEFAULTS: BkashSettingsJson = {
  isActive: false,
  liveMode: false,
  methodNameEn: 'bKash',
  methodNameBn: 'বিকাশের মাধ্যমে পেমেন্ট করুন',
  descriptionEn: 'Customer can buy product and pay with bKash',
  descriptionBn: 'অনলাইনে পেমেন্ট',
  logoUrl: '',
};

const CREDENTIAL_KEYS = {
  username: 'payment.bkash.username',
  password: 'payment.bkash.password',
  appKey: 'payment.bkash.appKey',
  appSecretKey: 'payment.bkash.appSecretKey',
} as const;

// bKash tokenized-checkout configuration. Deliberately NOT a new table: the
// non-secret half is one JSON row in the generic `Setting` table (same shape
// CourierSettingsService uses for Pathao/RedX) and the four secrets go
// through CredentialsService, which encrypts at rest. Nothing here touches
// PaymentMethodConfig[BKASH] — that row still holds the manual
// pay-to-a-merchant-number setup, which stays the fallback whenever this
// gateway is inactive or half-configured.
@Injectable()
export class BkashSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: CredentialsService,
  ) {}

  private async getJson(): Promise<BkashSettingsJson> {
    const row = await this.prisma.client.setting.findUnique({ where: { key: SETTING_KEY } });
    return row ? { ...DEFAULTS, ...(row.value as object) } : DEFAULTS;
  }

  async getConfig(): Promise<BkashConfig> {
    const json = await this.getJson();
    const [hasUsername, hasPassword, hasAppKey, hasAppSecretKey] = await Promise.all([
      this.credentials.hasCredential(CREDENTIAL_KEYS.username),
      this.credentials.hasCredential(CREDENTIAL_KEYS.password),
      this.credentials.hasCredential(CREDENTIAL_KEYS.appKey),
      this.credentials.hasCredential(CREDENTIAL_KEYS.appSecretKey),
    ]);
    return {
      ...json,
      hasUsername,
      hasPassword,
      hasAppKey,
      hasAppSecretKey,
      isConfigured: hasUsername && hasPassword && hasAppKey && hasAppSecretKey,
    };
  }

  async update(
    input: Partial<BkashSettingsJson> & Partial<BkashCredentials>,
  ): Promise<BkashConfig> {
    const current = await this.getJson();
    const next: BkashSettingsJson = {
      isActive: input.isActive ?? current.isActive,
      liveMode: input.liveMode ?? current.liveMode,
      methodNameEn: input.methodNameEn ?? current.methodNameEn,
      methodNameBn: input.methodNameBn ?? current.methodNameBn,
      descriptionEn: input.descriptionEn ?? current.descriptionEn,
      descriptionBn: input.descriptionBn ?? current.descriptionBn,
      logoUrl: input.logoUrl ?? current.logoUrl,
    };
    await this.prisma.client.setting.upsert({
      where: { key: SETTING_KEY },
      create: { key: SETTING_KEY, value: next as never },
      update: { value: next as never },
    });
    // saveCredential() ignores blank/undefined, so an untouched masked field
    // leaves the stored secret alone rather than wiping it.
    await Promise.all([
      this.credentials.saveCredential(CREDENTIAL_KEYS.username, input.username),
      this.credentials.saveCredential(CREDENTIAL_KEYS.password, input.password),
      this.credentials.saveCredential(CREDENTIAL_KEYS.appKey, input.appKey),
      this.credentials.saveCredential(CREDENTIAL_KEYS.appSecretKey, input.appSecretKey),
    ]);
    return this.getConfig();
  }

  // Null unless all four secrets are present — a half-filled gateway must
  // fall back to manual rather than fail a customer's checkout mid-payment.
  async getCredentials(): Promise<BkashCredentials | null> {
    const [username, password, appKey, appSecretKey] = await Promise.all([
      this.credentials.getCredential(CREDENTIAL_KEYS.username),
      this.credentials.getCredential(CREDENTIAL_KEYS.password),
      this.credentials.getCredential(CREDENTIAL_KEYS.appKey),
      this.credentials.getCredential(CREDENTIAL_KEYS.appSecretKey),
    ]);
    if (!username || !password || !appKey || !appSecretKey) return null;
    return { username, password, appKey, appSecretKey };
  }

  // The one question PaymentsService asks: should BKASH route to the gateway
  // or to the manual flow?
  async isGatewayLive(): Promise<boolean> {
    const json = await this.getJson();
    if (!json.isActive) return false;
    return (await this.getCredentials()) !== null;
  }

  async isLiveMode(): Promise<boolean> {
    return (await this.getJson()).liveMode;
  }

  // What checkout needs to offer bKash as an online option, with no secrets
  // and nothing about the merchant's environment. Null whenever the gateway
  // is not live, so the storefront simply doesn't show the option — the same
  // single source of truth PaymentsService.resolve uses, rather than a second
  // rule the two surfaces could drift apart on.
  async getPublicConfig(): Promise<PublicBkashConfig | null> {
    if (!(await this.isGatewayLive())) return null;
    const json = await this.getJson();
    return {
      methodNameEn: json.methodNameEn,
      methodNameBn: json.methodNameBn,
      descriptionEn: json.descriptionEn,
      descriptionBn: json.descriptionBn,
      logoUrl: json.logoUrl,
    };
  }
}
