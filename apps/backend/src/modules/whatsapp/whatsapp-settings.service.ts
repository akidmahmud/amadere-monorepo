import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

const KEY = 'whatsapp.settings';

export interface WhatsappSettings {
  enabled: boolean;
  phoneNumber: string;
  productMessageTemplate: string;
  floatingMessageTemplate: string;
  // Product-page "Call to order" button. Separate number from WhatsApp on
  // purpose: the shop's landline or hotline is often not the WhatsApp line.
  // No migration needed for these — the row is a JSON blob and getSettings
  // spreads DEFAULTS underneath it, so existing rows pick them up.
  callEnabled: boolean;
  callNumber: string;
}

// {{productName}} is the only placeholder the product-order button
// substitutes (WhatsappOrderButton on the storefront) — the floating button
// has no product context, so its template is used as-is.
const DEFAULTS: WhatsappSettings = {
  enabled: false,
  phoneNumber: '',
  productMessageTemplate: "Hi, I'm interested in {{productName}}. Could you share more details?",
  floatingMessageTemplate: 'Hi, I have a question about your products.',
  // Defaults ON, not off: CallNowButton already shows on every product page
  // today whenever a number exists. Defaulting to false would silently remove
  // a live button the moment this shipped.
  callEnabled: true,
  callNumber: '',
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
      callEnabled: input.callEnabled ?? current.callEnabled,
      callNumber: input.callNumber ?? current.callNumber,
    };
    await this.prisma.client.setting.upsert({
      where: { key: KEY },
      create: { key: KEY, value: next as never },
      update: { value: next as never },
    });
    return next;
  }
}
