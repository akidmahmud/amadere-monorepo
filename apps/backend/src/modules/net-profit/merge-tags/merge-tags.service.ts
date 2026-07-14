import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/prisma/prisma.service';

const SITE_NAME_KEY = 'site_name';
const DEFAULT_SITE_NAME = 'আমাদের';

export interface MergeTagCartItem {
  name: string;
  slug: string;
}

export interface MergeTagContext {
  customerId?: number | null;
  phone?: string | null;
  email?: string | null;
  amount: string;
  cart: MergeTagCartItem[];
}

// The 13-tag merge system (Recovery/Cart Abandonment parity) — shared by
// CartCampaignsService (scheduled multi-step campaigns) and
// RecoveryService (the manual/on-demand single SMS), so both surfaces
// offer the same placeholders. Unknown {{tokens}} render as empty string
// rather than being left literally in the message.
@Injectable()
export class MergeTagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async render(raw: string, ctx: MergeTagContext): Promise<string> {
    const tokens = await this.buildTokens(ctx);
    return raw.replace(/\{\{(\w+)\}\}/g, (_, key: string) => tokens[key] ?? '');
  }

  private async buildTokens(ctx: MergeTagContext): Promise<Record<string, string>> {
    const base = this.config.get<string>('STOREFRONT_BASE_URL') ?? '';

    let customerName = '';
    if (ctx.customerId) {
      const customer = await this.prisma.client.customer.findUnique({ where: { id: ctx.customerId } });
      customerName = customer ? `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim() : '';
    }
    const firstName = customerName.split(' ')[0] || 'Customer';

    const siteNameSetting = await this.prisma.client.setting.findUnique({ where: { key: SITE_NAME_KEY } });
    const siteName = typeof siteNameSetting?.value === 'string' ? siteNameSetting.value : DEFAULT_SITE_NAME;

    const productNames = ctx.cart.map((i) => i.name).join(', ');
    const productUrls = ctx.cart.map((i) => `${base}/products/${i.slug}`).join(', ');
    const productLinks = ctx.cart.map((i) => `<p><a href="${base}/products/${i.slug}">${i.name}</a></p>`).join('');

    const amount = Number(ctx.amount) || 0;
    const resumeUrl = `${base}/cart`;

    return {
      customerName: customerName || 'Customer',
      firstName,
      customerEmail: ctx.email ?? '',
      customerPhone: ctx.phone ?? '',
      amount: amount.toFixed(2),
      amountWithCurrency: `৳${amount.toLocaleString()}`,
      productNames,
      productLinks,
      productUrls,
      cartLink: resumeUrl,
      checkoutLink: `${base}/checkout`,
      siteName,
      siteUrl: base,
      // Kept for backward compatibility with the already-seeded 'recovery'
      // SMS template, which predates this merge-tag system.
      resumeUrl,
    };
  }
}
