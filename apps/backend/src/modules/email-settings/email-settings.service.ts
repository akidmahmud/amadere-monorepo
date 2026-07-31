import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CredentialsService } from '../../common/credentials/credentials.service';

const KEY = 'email.settings';
const CREDENTIAL_KEY = 'email.smtp.password';

export type SmtpEncryption = 'none' | 'tls' | 'ssl';

export interface EmailConfig {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  encryption: SmtpEncryption;
  senderName: string;
  senderEmail: string;
  hasPassword: boolean;
}

interface EmailSettingsJson {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  encryption: SmtpEncryption;
  senderName: string;
  senderEmail: string;
}

const DEFAULTS: EmailSettingsJson = {
  enabled: false,
  host: '',
  port: 587,
  username: '',
  encryption: 'tls',
  senderName: '',
  senderEmail: '',
};

// Same split as CourierSettingsService: non-secret fields in the generic
// Setting table, the password through CredentialsService (encrypted at
// rest) — admin-configured values win over the .env SMTP_* fallback
// SmtpEmailProvider already had, same "DB wins, .env is the bootstrap
// fallback" posture as every other provider this session.
@Injectable()
export class EmailSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: CredentialsService,
  ) {}

  private async getJson(): Promise<EmailSettingsJson> {
    const row = await this.prisma.client.setting.findUnique({ where: { key: KEY } });
    return row ? { ...DEFAULTS, ...(row.value as object) } : DEFAULTS;
  }

  async getConfig(): Promise<EmailConfig> {
    const json = await this.getJson();
    const hasPassword = await this.credentials.hasCredential(CREDENTIAL_KEY);
    return { ...json, hasPassword };
  }

  async updateConfig(
    input: Partial<EmailSettingsJson> & { password?: string },
  ): Promise<EmailConfig> {
    const current = await this.getJson();
    const next: EmailSettingsJson = {
      enabled: input.enabled ?? current.enabled,
      host: input.host ?? current.host,
      port: input.port ?? current.port,
      username: input.username ?? current.username,
      encryption: input.encryption ?? current.encryption,
      senderName: input.senderName ?? current.senderName,
      senderEmail: input.senderEmail ?? current.senderEmail,
    };
    await this.prisma.client.setting.upsert({
      where: { key: KEY },
      create: { key: KEY, value: next as never },
      update: { value: next as never },
    });
    if (input.password) await this.credentials.saveCredential(CREDENTIAL_KEY, input.password);
    return this.getConfig();
  }

  // Real password, only for SmtpEmailProvider's own use — never returned
  // from an admin-facing endpoint.
  async getCredentials(): Promise<EmailSettingsJson & { password: string | null }> {
    const json = await this.getJson();
    const password = await this.credentials.getCredential(CREDENTIAL_KEY);
    return { ...json, password };
  }
}
