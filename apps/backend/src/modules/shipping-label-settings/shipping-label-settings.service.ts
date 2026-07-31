import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

const KEY = 'shipping_label.settings';

export interface ShippingLabelSettings {
  enabled: boolean;
  template: string;
}

const DEFAULTS: ShippingLabelSettings = { enabled: false, template: '' };

// Raw HTML with {{merge-tag}} placeholders, same convention as SMS/cart-
// recovery campaign templates elsewhere in this codebase — not Twig (no
// server-side template engine here), just string substitution done by
// LabelDocument.tsx. Inline styles only: this string can be rendered
// standalone via dangerouslySetInnerHTML, so it can't rely on Tailwind
// classes that may not exist in the compiled CSS (Tailwind only generates
// CSS for class names it finds by static analysis at build time).
export const DEFAULT_SHIPPING_LABEL_TEMPLATE = `<div style="max-width:28rem;margin:0 auto;border:2px solid black;padding:1.5rem;font-family:sans-serif;color:black;">
  <div style="display:flex;justify-content:space-between;border-bottom:2px solid black;padding-bottom:0.75rem;margin-bottom:1rem;">
    <div style="font-size:1.125rem;font-weight:bold;">{{companyName}}</div>
    <div style="text-align:right;font-size:0.75rem;">
      <div>{{orderNumber}}</div>
      <div>{{date}}</div>
    </div>
  </div>
  <p style="font-size:0.75rem;font-weight:bold;text-transform:uppercase;color:#666;margin:0;">Deliver to</p>
  <p style="font-size:1.125rem;font-weight:bold;margin:0.25rem 0;">{{recipientName}}</p>
  <p style="font-size:1rem;margin:0.25rem 0;">{{phone}}</p>
  <p style="margin:0.25rem 0;">{{addressLine}}</p>
  <p style="margin:0.25rem 0;">{{addressFull}}</p>
  <div style="margin-top:1rem;display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;border-top:2px solid black;padding-top:0.75rem;font-size:0.875rem;">
    <div><span style="color:#666;">Tracking</span><div style="font-weight:bold;">{{trackingCode}}</div></div>
    <div><span style="color:#666;">Provider</span><div style="font-weight:bold;">{{provider}}</div></div>
    <div><span style="color:#666;">Weight</span><div style="font-weight:bold;">{{weight}} kg</div></div>
    <div><span style="color:#666;">Items</span><div style="font-weight:bold;">{{itemCount}}</div></div>
  </div>
  <div style="margin-top:1rem;border-top:2px solid black;padding-top:0.75rem;text-align:center;">
    <p style="font-size:0.75rem;font-weight:bold;text-transform:uppercase;color:#666;margin:0;">Cash on delivery</p>
    <p style="font-size:1.875rem;font-weight:bold;margin:0;">{{currency}} {{codAmount}}</p>
  </div>
</div>`;

@Injectable()
export class ShippingLabelSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<ShippingLabelSettings> {
    const row = await this.prisma.client.setting.findUnique({ where: { key: KEY } });
    return row ? { ...DEFAULTS, ...(row.value as object) } : DEFAULTS;
  }

  async updateSettings(input: Partial<ShippingLabelSettings>): Promise<ShippingLabelSettings> {
    const next = { ...(await this.getSettings()), ...input };
    await this.prisma.client.setting.upsert({
      where: { key: KEY },
      create: { key: KEY, value: next as never },
      update: { value: next as never },
    });
    return next;
  }
}
