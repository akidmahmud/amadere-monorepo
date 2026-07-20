import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

const KEY = 'whatsapp.settings';

export interface WhatsappSettings {
  enabled: boolean;
  phoneNumber: string;
  productMessageTemplate: string;
  floatingMessageTemplate: string;
}

// {{productName}} is the only placeholder the product-order button
// substitutes (WhatsappOrderButton on the storefront) — the floating button
// has no product context, so its template is used as-is.
const DEFAULTS: WhatsappSettings = {
  enabled: false,
  phoneNumber: '',
  productMessageTemplate: "Hi, I'm interested in {{productName}}. Could you share more details?",
  floatingMessageTemplate: 'Hi, I have a question about your products.',
};

// One settings row in the generic `Setting` table (same reuse-over-fork
// pattern as NetProfitSettingsService/CourierSettingsService) — a WhatsApp
// number and message templates aren't secrets, so no CredentialsService
// involvement, and both the admin editor and the public storefront read the
// exact same shape.
@Injectable()
export class WhatsappSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<WhatsappSettings> {
    const row = await this.prisma.client.setting.findUnique({ where: { key: KEY } });
    return row ? { ...DEFAULTS, ...(row.value as object) } : DEFAULTS;
  }

  async updateSettings(input: Partial<WhatsappSettings>): Promise<WhatsappSettings> {
    const current = await this.getSettings();
    const next: WhatsappSettings = {
      enabled: input.enabled ?? current.enabled,
      phoneNumber: input.phoneNumber ?? current.phoneNumber,
      productMessageTemplate: input.productMessageTemplate ?? current.productMessageTemplate,
      floatingMessageTemplate: input.floatingMessageTemplate ?? current.floatingMessageTemplate,
    };
    await this.prisma.client.setting.upsert({
      where: { key: KEY },
      create: { key: KEY, value: next as never },
      update: { value: next as never },
    });
    return next;
  }
}
