import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

const KEY = 'invoice_template.settings';

export interface InvoiceTemplateSettings {
  enabled: boolean;
  template: string;
}

const DEFAULTS: InvoiceTemplateSettings = { enabled: false, template: '' };

// Same raw-HTML-with-{{merge-tags}} convention as
// shipping-label-settings.service.ts's DEFAULT_SHIPPING_LABEL_TEMPLATE — no
// server-side template engine, just string substitution done client-side by
// InvoiceDocument.tsx. Line items can't be expressed as a single merge tag
// (variable row count), so {{itemsTableRows}}/{{discountRow}}/{{taxRow}}/
// {{codFeeRow}}/{{shippingRow}}/{{courierBoxHtml}} are pre-rendered HTML
// fragments built by buildInvoiceMergeTags() in the admin app, same trick
// used for conditional rows. Visual design follows the real Amader invoice
// reference ("SteadFast Invoice.htm"): rounded card, Invoice To / Pay To
// columns, courier consignment box (parcel ID/COD amount when the order has
// a shipment), bordered item table, totals footer, terms box.
export const DEFAULT_INVOICE_TEMPLATE = `<div style="font-family:'Inter',Arial,sans-serif;color:#666;font-size:14px;line-height:1.6;background:#f5f6fa;padding:30px;">
  <div style="max-width:900px;margin:0 auto;background:#fff;border-radius:10px;padding:50px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
      <div>{{companyLogoHtml}}</div>
      <div style="text-align:right;font-size:30px;font-weight:700;color:#111;text-transform:uppercase;">Invoice</div>
    </div>
    <div style="display:flex;align-items:center;margin-bottom:20px;">
      <div style="margin-right:20px;height:2px;flex:1;border-radius:1.6em;background:#111;"></div>
      <div style="display:flex;gap:20px;white-space:nowrap;color:#111;">
        <p style="margin:0;">Invoice No: <strong>{{invoiceNumber}}</strong></p>
        <p style="margin:0;">Date: <strong>{{invoiceDate}}</strong></p>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;gap:20px;margin-bottom:20px;">
      <div>
        <p style="margin:0 0 4px;color:#111;"><strong>Invoice To:</strong></p>
        <p style="margin:0;">{{customerName}}<br>{{customerAddress}}<br>{{customerPhone}}</p>
      </div>
      <div style="text-align:right;">
        <p style="margin:0 0 4px;color:#111;"><strong>Pay To:</strong></p>
        <p style="margin:0;">{{companyName}}<br>{{companyAddress}}<br>{{companyEmail}}</p>
      </div>
    </div>
    {{courierBoxHtml}}
    <div style="border:1px solid #dbdfea;border-radius:6px;overflow:hidden;margin-bottom:20px;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f5f6fa;">
            <th style="padding:10px 15px;text-align:left;color:#111;">Item</th>
            <th style="padding:10px 15px;text-align:left;color:#111;">Price</th>
            <th style="padding:10px 15px;text-align:left;color:#111;">Qty</th>
            <th style="padding:10px 15px;text-align:right;color:#111;">Total</th>
          </tr>
        </thead>
        <tbody>{{itemsTableRows}}</tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;gap:20px;">
      <div style="width:55%;">
        <p style="margin:0 0 4px;color:#111;"><strong>Payment info:</strong></p>
        <p style="margin:0;">{{paymentMethod}}</p>
      </div>
      <div style="width:45%;">
        <table style="width:100%;border-collapse:collapse;">
          <tbody>
            <tr><td style="padding:4px 0;color:#111;">Subtotal</td><td style="padding:4px 0;text-align:right;color:#111;">{{currency}} {{subTotal}}</td></tr>
            {{discountRow}}
            {{shippingRow}}
            {{taxRow}}
            {{codFeeRow}}
            <tr style="border-top:2px solid #111;border-bottom:2px solid #111;"><td style="padding:8px 0;font-weight:700;font-size:16px;color:#111;">Grand Total</td><td style="padding:8px 0;text-align:right;font-weight:700;font-size:16px;color:#111;">{{currency}} {{totalAmount}}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    {{stampImageHtml}}
    {{termsBlock}}
  </div>
</div>`;

@Injectable()
export class InvoiceTemplateSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<InvoiceTemplateSettings> {
    const row = await this.prisma.client.setting.findUnique({ where: { key: KEY } });
    return row ? { ...DEFAULTS, ...(row.value as object) } : DEFAULTS;
  }

  async updateSettings(input: Partial<InvoiceTemplateSettings>): Promise<InvoiceTemplateSettings> {
    const next = { ...(await this.getSettings()), ...input };
    await this.prisma.client.setting.upsert({
      where: { key: KEY },
      create: { key: KEY, value: next as never },
      update: { value: next as never },
    });
    return next;
  }
}
