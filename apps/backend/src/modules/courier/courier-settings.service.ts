import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CredentialsService } from '../../common/credentials/credentials.service';

const KEY_PREFIX = 'courier.';

export interface SteadfastConfig {
  enabled: boolean;
  hasApiKey: boolean;
  hasSecretKey: boolean;
}

export interface PathaoConfig {
  enabled: boolean;
  environment: 'live' | 'sandbox';
  autoStatusSync: boolean;
  clientId: string;
  username: string;
  storeId: number | null;
  hasClientSecret: boolean;
  hasPassword: boolean;
}

export interface RedxConfig {
  enabled: boolean;
  environment: 'live' | 'sandbox';
  autoStatusSync: boolean;
  pickupStoreId: number | null;
  hasApiToken: boolean;
}

interface PathaoSettingsJson {
  enabled: boolean;
  environment: 'live' | 'sandbox';
  autoStatusSync: boolean;
  clientId: string;
  username: string;
  storeId: number | null;
}

interface RedxSettingsJson {
  enabled: boolean;
  environment: 'live' | 'sandbox';
  autoStatusSync: boolean;
  pickupStoreId: number | null;
}

interface SteadfastSettingsJson {
  enabled: boolean;
}

const PATHAO_DEFAULTS: PathaoSettingsJson = {
  enabled: false,
  environment: 'live',
  autoStatusSync: false,
  clientId: '',
  username: '',
  storeId: null,
};
const REDX_DEFAULTS: RedxSettingsJson = { enabled: false, environment: 'live', autoStatusSync: false, pickupStoreId: null };
const STEADFAST_DEFAULTS: SteadfastSettingsJson = { enabled: true };

// Courier credential/config storage — the plugin's central "Courier" tab
// (per-provider enable/environment/store + masked secret fields), ported
// as a real admin-editable settings surface instead of `.env`-only
// (previously the single biggest courier gap: no admin UI existed at all).
// Non-secret fields live in the generic `Setting` table (same pattern as
// NetProfitSettingsService, just prefixed "courier." instead of
// "net_profit." since courier config is base fulfillment, not a Net Profit
// add-on); secrets go through CredentialsService (encrypted at rest).
@Injectable()
export class CourierSettingsService {
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

  async getSteadfastConfig(): Promise<SteadfastConfig> {
    const json = await this.getJson('steadfast', STEADFAST_DEFAULTS);
    const [hasApiKey, hasSecretKey] = await Promise.all([
      this.credentials.hasCredential('courier.steadfast.apiKey'),
      this.credentials.hasCredential('courier.steadfast.secretKey'),
    ]);
    return { ...json, hasApiKey, hasSecretKey };
  }

  async updateSteadfastConfig(input: { enabled?: boolean; apiKey?: string; secretKey?: string }): Promise<SteadfastConfig> {
    const current = await this.getJson('steadfast', STEADFAST_DEFAULTS);
    await this.setJson('steadfast', { enabled: input.enabled ?? current.enabled });
    await this.credentials.saveCredential('courier.steadfast.apiKey', input.apiKey);
    await this.credentials.saveCredential('courier.steadfast.secretKey', input.secretKey);
    return this.getSteadfastConfig();
  }

  async getSteadfastCredentials(): Promise<{ apiKey: string | null; secretKey: string | null }> {
    const [apiKey, secretKey] = await Promise.all([
      this.credentials.getCredential('courier.steadfast.apiKey'),
      this.credentials.getCredential('courier.steadfast.secretKey'),
    ]);
    return { apiKey, secretKey };
  }

  async getPathaoConfig(): Promise<PathaoConfig> {
    const json = await this.getJson('pathao', PATHAO_DEFAULTS);
    const [hasClientSecret, hasPassword] = await Promise.all([
      this.credentials.hasCredential('courier.pathao.clientSecret'),
      this.credentials.hasCredential('courier.pathao.password'),
    ]);
    return { ...json, hasClientSecret, hasPassword };
  }

  async updatePathaoConfig(
    input: Partial<PathaoSettingsJson> & { clientSecret?: string; password?: string },
  ): Promise<PathaoConfig> {
    const current = await this.getJson('pathao', PATHAO_DEFAULTS);
    await this.setJson('pathao', {
      enabled: input.enabled ?? current.enabled,
      environment: input.environment ?? current.environment,
      autoStatusSync: input.autoStatusSync ?? current.autoStatusSync,
      clientId: input.clientId ?? current.clientId,
      username: input.username ?? current.username,
      storeId: input.storeId ?? current.storeId,
    });
    await this.credentials.saveCredential('courier.pathao.clientSecret', input.clientSecret);
    await this.credentials.saveCredential('courier.pathao.password', input.password);
    return this.getPathaoConfig();
  }

  async getPathaoCredentials(): Promise<{ clientId: string; clientSecret: string | null; username: string; password: string | null }> {
    const json = await this.getJson('pathao', PATHAO_DEFAULTS);
    const [clientSecret, password] = await Promise.all([
      this.credentials.getCredential('courier.pathao.clientSecret'),
      this.credentials.getCredential('courier.pathao.password'),
    ]);
    return { clientId: json.clientId, clientSecret, username: json.username, password };
  }

  async getRedxConfig(): Promise<RedxConfig> {
    const json = await this.getJson('redx', REDX_DEFAULTS);
    const hasApiToken = await this.credentials.hasCredential('courier.redx.apiToken');
    return { ...json, hasApiToken };
  }

  async updateRedxConfig(input: Partial<RedxSettingsJson> & { apiToken?: string }): Promise<RedxConfig> {
    const current = await this.getJson('redx', REDX_DEFAULTS);
    await this.setJson('redx', {
      enabled: input.enabled ?? current.enabled,
      environment: input.environment ?? current.environment,
      autoStatusSync: input.autoStatusSync ?? current.autoStatusSync,
      pickupStoreId: input.pickupStoreId ?? current.pickupStoreId,
    });
    await this.credentials.saveCredential('courier.redx.apiToken', input.apiToken);
    return this.getRedxConfig();
  }

  async getRedxCredentials(): Promise<{ apiToken: string | null }> {
    const apiToken = await this.credentials.getCredential('courier.redx.apiToken');
    return { apiToken };
  }
}
