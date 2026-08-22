import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

const KEY = 'invoice.settings';

export type InvoiceDateFormat = 'MDY' | 'DMY' | 'YMD';
export type InvoiceLanguageSupport = 'default' | 'arabic' | 'bengali' | 'chinese';

export interface InvoiceSettings {
  companyName: string;
  companyAddress: string;
  companyCity: string;
  companyState: string;
  companyCountry: string;
  companyZipcode: string;
  companyEmail: string;
  companyPhone: string;
  companyTaxId: string;
  companyLogoUrl: string | null;
  // Cosmetic label prepended to the order number on the invoice itself
  // only — this codebase has one order-numbering sequence
  // (generateOrderNumber), not a separate invoice-numbering ledger like the
  // reference's Botble/Laravel system, so this isn't a second counter.
  invoicePrefix: string;
  dateFormat: InvoiceDateFormat;
  disableUntilConfirmed: boolean;
  stampEnabled: boolean;
  stampImageUrl: string | null;
  customFontEnabled: boolean;
  customFontFamily: string;
  languageSupport: InvoiceLanguageSupport;
  termsAndConditions: string;
  // The contact strip printed at the foot of the invoice. These were three
  // hardcoded literals in InvoiceDocument.tsx sitting next to a settings-driven
  // companyPhone — so changing your company details updated one tile and left
  // the others stale, which looks maintained but isn't. Empty hides its tile.
  companyWebsite: string;
  companyFacebook: string;
  trustBadgeTitle: string;
  trustBadgeSubtitle: string;
}

const DEFAULTS: InvoiceSettings = {
  companyName: 'Amader™ eBuy Ltd',
  companyAddress: 'Moyshan Bari, Salna, Gazipur City Corporation',
  companyCity: 'Gazipur',
  companyState: 'Gazipur',
  companyCountry: 'Bangladesh',
  companyZipcode: '',
  companyEmail: 'amaderecommercer@gmail.com',
  companyPhone: '',
  companyTaxId: '',
  companyLogoUrl: null,
  invoicePrefix: '',
  dateFormat: 'MDY',
  disableUntilConfirmed: false,
  stampEnabled: false,
  stampImageUrl: null,
  customFontEnabled: false,
  customFontFamily: '',
  languageSupport: 'default',
  termsAndConditions: '',
  // Carried over verbatim from the literals they replace, so existing
  // invoices print exactly the same until an admin edits them.
  companyWebsite: 'www.amadere.com',
  companyFacebook: 'fb.com/amadere',
  trustBadgeTitle: '100% Natural & Healthy',
  trustBadgeSubtitle: 'Trusted by Thousands',
};

// Same generic-Setting-table pattern as every other *SettingsService this
// session (Sitemap, Analytics, Courier) — one JSON blob, no secrets.
@Injectable()
export class InvoiceSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<InvoiceSettings> {
    const row = await this.prisma.client.setting.findUnique({ where: { key: KEY } });
    return row ? { ...DEFAULTS, ...(row.value as object) } : DEFAULTS;
  }

  async updateSettings(input: Partial<InvoiceSettings>): Promise<InvoiceSettings> {
    const next = { ...(await this.getSettings()), ...input };
    await this.prisma.client.setting.upsert({
      where: { key: KEY },
      create: { key: KEY, value: next as never },
      update: { value: next as never },
    });
    return next;
  }
}
