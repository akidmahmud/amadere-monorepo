import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Locale } from '@amader/db';
import { PaginatedResult } from '@amader/shared';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CredentialsService } from '../../../common/credentials/credentials.service';
import { paginationArgs, toPaginatedResult } from '../../../common/pagination.util';
import { NetProfitSettingsService } from '../settings/net-profit-settings.service';
import { BulkSmsBdProvider, SMS_API_KEY_CREDENTIAL } from './providers/bulk-sms-bd.provider';
import { UpdateSmsTemplateDto } from './dto/update-sms-template.dto';
import { SmsLogDto, SmsTemplateDto, toSmsLogDto, toSmsTemplateDto } from './sms.mapper';

const SETTINGS_NAMESPACE = 'sms';

export interface SmsSettings {
  enabled: boolean;
  // ADDENDUM §H — sender ID lives here (not just env) since it isn't a
  // secret and an admin may want to change it without a redeploy.
  // `senderIdMasked` is informational only — BD gateways decide masked-vs-
  // non-masked billing/routing server-side from the sender ID string
  // itself, there's no separate API flag for it. The API key is NOT part
  // of this namespace — it's a secret, stored via CredentialsService
  // instead (see getSettings/updateSettings below).
  senderId: string;
  senderIdMasked: boolean;
  // Which order-status transitions fire a template SMS (parity with the
  // plugin's per-status trigger toggles) — SmsEventListener reads this
  // instead of hardcoding which transitions matter. Only statuses with a
  // matching named template are offered; ours has no cancelled/refunded/
  // failed template yet, so those aren't configurable here.
  statusTriggers: { CONFIRMED: boolean; PROCESSING: boolean; COMPLETED: boolean };
}

const SMS_SETTINGS_DEFAULTS: SmsSettings = {
  enabled: false,
  senderId: '',
  senderIdMasked: false,
  statusTriggers: { CONFIRMED: true, PROCESSING: false, COMPLETED: true },
};

// Seed: otp, order_placed, order_confirmed, order_shipped, order_delivered,
// recovery, advance_request (spec §7.4's exact list).
const DEFAULT_TEMPLATES: { key: string; bodyEn: string; bodyBn: string }[] = [
  { key: 'otp', bodyEn: 'Your Amader verification code is {{code}}. It expires in 5 minutes.', bodyBn: 'আপনার আমাদের যাচাইকরণ কোড {{code}}। এটি ৫ মিনিটে মেয়াদ শেষ হবে।' },
  { key: 'order_placed', bodyEn: 'Thanks for your order {{orderNumber}}! Total: ৳{{amount}}. We will confirm it shortly.', bodyBn: 'আপনার অর্ডার {{orderNumber}} এর জন্য ধন্যবাদ! মোট: ৳{{amount}}। আমরা শীঘ্রই এটি নিশ্চিত করব।' },
  { key: 'order_confirmed', bodyEn: 'Your order {{orderNumber}} has been confirmed and is being prepared.', bodyBn: 'আপনার অর্ডার {{orderNumber}} নিশ্চিত করা হয়েছে এবং প্রস্তুত করা হচ্ছে।' },
  { key: 'order_shipped', bodyEn: 'Your order {{orderNumber}} has been shipped via {{courier}}. Track: {{trackingUrl}}', bodyBn: 'আপনার অর্ডার {{orderNumber}} {{courier}} এর মাধ্যমে পাঠানো হয়েছে। ট্র্যাক করুন: {{trackingUrl}}' },
  { key: 'order_delivered', bodyEn: 'Your order {{orderNumber}} has been delivered. Thank you for shopping with Amader!', bodyBn: 'আপনার অর্ডার {{orderNumber}} ডেলিভারি করা হয়েছে। আমাদের সাথে কেনাকাটা করার জন্য ধন্যবাদ!' },
  { key: 'recovery', bodyEn: 'You left items in your cart! Complete your order here: {{resumeUrl}}', bodyBn: 'আপনি আপনার কার্টে কিছু পণ্য রেখে গেছেন! এখানে আপনার অর্ডার সম্পূর্ণ করুন: {{resumeUrl}}' },
  { key: 'advance_request', bodyEn: 'Please pay ৳{{amount}} in advance to confirm order {{orderNumber}}: {{payUrl}}', bodyBn: 'অর্ডার {{orderNumber}} নিশ্চিত করতে অনুগ্রহ করে ৳{{amount}} অগ্রিম পরিশোধ করুন: {{payUrl}}' },
];

@Injectable()
export class SmsService implements OnModuleInit {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: NetProfitSettingsService,
    private readonly credentials: CredentialsService,
    private readonly provider: BulkSmsBdProvider,
  ) {}

  // Idempotent in-app seeding (upsert on unique `key`) rather than a
  // standalone script — safe to run on every boot, no sandbox-blocked
  // broad-seed concern (AGENTS.md's seed.ts is a separate, larger surface).
  async onModuleInit(): Promise<void> {
    for (const t of DEFAULT_TEMPLATES) {
      await this.prisma.client.smsTemplate.upsert({
        where: { key: t.key },
        create: t,
        update: {},
      });
    }
  }

  async getSettings(): Promise<SmsSettings & { hasApiKey: boolean }> {
    const [settings, hasApiKey] = await Promise.all([
      this.settings.getNamespace(SETTINGS_NAMESPACE, SMS_SETTINGS_DEFAULTS),
      this.credentials.hasCredential(SMS_API_KEY_CREDENTIAL),
    ]);
    return { ...settings, hasApiKey };
  }

  async updateSettings(dto: Partial<SmsSettings> & { apiKey?: string }): Promise<SmsSettings & { hasApiKey: boolean }> {
    const { apiKey, ...rest } = dto;
    const merged: Partial<SmsSettings> = { ...rest };
    if (dto.statusTriggers) {
      const current = await this.getSettings();
      merged.statusTriggers = { ...current.statusTriggers, ...dto.statusTriggers };
    }
    await this.settings.setNamespace(SETTINGS_NAMESPACE, merged);
    // Blank/undefined never overwrites an existing key (CredentialsService's
    // own guard) — matches the masked "leave blank to keep" UX everywhere
    // else credentials are edited.
    await this.credentials.saveCredential(SMS_API_KEY_CREDENTIAL, apiKey);
    return this.getSettings();
  }

  async clearApiKey(): Promise<SmsSettings & { hasApiKey: boolean }> {
    await this.credentials.deleteCredential(SMS_API_KEY_CREDENTIAL);
    return this.getSettings();
  }

  async listTemplates(): Promise<SmsTemplateDto[]> {
    const rows = await this.prisma.client.smsTemplate.findMany({ orderBy: { key: 'asc' } });
    return rows.map(toSmsTemplateDto);
  }

  async updateTemplate(key: string, dto: UpdateSmsTemplateDto): Promise<SmsTemplateDto> {
    const row = await this.prisma.client.smsTemplate.update({ where: { key }, data: dto });
    return toSmsTemplateDto(row);
  }

  async listLogs(page: number, pageSize: number): Promise<PaginatedResult<SmsLogDto>> {
    const [items, total] = await Promise.all([
      this.prisma.client.smsLog.findMany({ orderBy: { createdAt: 'desc' }, ...paginationArgs(page, pageSize) }),
      this.prisma.client.smsLog.count(),
    ]);
    return toPaginatedResult(items.map(toSmsLogDto), total, page, pageSize);
  }

  // Raw send + log — used by test-send and by sendTemplate below. Never
  // throws: `enabled=false` or a provider failure both just log FAILED/
  // skip, so a bad SMS gateway can never break the order/checkout flow
  // that triggered it (§3.4).
  async send(to: string, body: string, templateKey?: string): Promise<SmsLogDto> {
    const settings = await this.getSettings();
    if (!settings.enabled) {
      const row = await this.prisma.client.smsLog.create({
        data: { to, body, templateKey, status: 'FAILED', provider: this.provider.name, meta: { reason: 'sms_disabled' } },
      });
      return toSmsLogDto(row);
    }

    const result = await this.provider.send(to, body, settings.senderId || undefined);
    const row = await this.prisma.client.smsLog.create({
      data: {
        to,
        body,
        templateKey,
        status: result.failed ? 'FAILED' : 'SENT',
        provider: this.provider.name,
        cost: result.cost,
        meta: result.failed
          ? { error: result.error, code: result.code, codeMessage: result.codeMessage }
          : { id: result.id, code: result.code, codeMessage: result.codeMessage },
      },
    });
    if (result.failed) this.logger.warn(`SMS to ${to} failed: ${result.error}`);
    return toSmsLogDto(row);
  }

  async sendTemplate(
    key: string,
    to: string,
    locale: Locale,
    params: Record<string, string | number>,
  ): Promise<SmsLogDto | null> {
    const template = await this.prisma.client.smsTemplate.findUnique({ where: { key } });
    if (!template || !template.enabled) return null;

    const raw = locale === 'BN' ? template.bodyBn : template.bodyEn;
    const body = raw.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(params[k] ?? ''));
    return this.send(to, body, key);
  }

  // ADDENDUM §H — real balance from the gateway, not a stored/cached number
  // (so it can never show stale). `unavailable` (no credentials, or the
  // gateway call itself failed) surfaces as null, not a fake zero.
  async getBalance(): Promise<number | null> {
    if (!this.provider.getBalance) return null;
    const result = await this.provider.getBalance();
    return 'unavailable' in result ? null : result.balance;
  }

  // ADDENDUM §H — admin broadcast to a filtered customer segment, in
  // addition to the transactional template triggers. Reuses `send()` so
  // every recipient still gets its own real SmsLog row.
  // ponytail: sends in-request, sequentially — fine for an on-demand admin
  // action with no queue infra in this stack yet; move to BullMQ (already
  // in AGENTS.md's intended tech stack) if a broadcast ever needs to span
  // thousands of recipients without blocking the request.
  async bulkSend(body: string, segment: 'all' | 'has_ordered'): Promise<{ queued: number }> {
    const where = segment === 'has_ordered' ? { phone: { not: null }, orders: { some: {} } } : { phone: { not: null } };
    const customers = await this.prisma.client.customer.findMany({ where, select: { phone: true } });
    const phones = customers.map((c) => c.phone).filter((p): p is string => p !== null);
    for (const phone of phones) {
      await this.send(phone, body, 'bulk_broadcast');
    }
    return { queued: phones.length };
  }
}
