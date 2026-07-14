import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { DelayUnit } from '@amader/db';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NetProfitSettingsService } from '../settings/net-profit-settings.service';
import { SmsService } from '../sms/sms.service';
import { SmtpEmailProvider } from './providers/smtp-email.provider';
import { UpsertCampaignTemplateDto } from './dto/upsert-campaign-template.dto';
import {
  CartCampaignQueueDto,
  CartCampaignTemplateDto,
  CartCampaignLogDto,
  toCartCampaignQueueDto,
  toCartCampaignTemplateDto,
  toCartCampaignLogDto,
} from './cart-campaigns.mapper';

export interface CampaignSettings {
  enabled: boolean;
  maxAttempts: number;
  quietHoursStart: number;
  quietHoursEnd: number;
}

const DEFAULTS: CampaignSettings = { enabled: false, maxAttempts: 3, quietHoursStart: 22, quietHoursEnd: 8 };

function delayToMs(value: number, unit: DelayUnit): number {
  const perUnit = { MINUTE: 60_000, HOUR: 3_600_000, DAY: 86_400_000 } as const;
  return value * perUnit[unit];
}

function renderBody(raw: string, resumeUrl: string): string {
  return raw.replace(/\{\{resumeUrl\}\}/g, resumeUrl);
}

// ADDENDUM §C — a separate, automated, multi-channel, scheduled win-back
// engine, distinct from RecoveryService's manual/on-demand single-SMS send
// (base §7.7). `CartCampaignQueue` is the scheduler table this class both
// writes to (on capture) and drains (the cron worker).
@Injectable()
export class CartCampaignsService {
  private readonly logger = new Logger(CartCampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: NetProfitSettingsService,
    private readonly sms: SmsService,
    private readonly email: SmtpEmailProvider,
    private readonly config: ConfigService,
  ) {}

  async getSettings(): Promise<CampaignSettings> {
    return this.settings.getNamespace('cart_campaigns', DEFAULTS);
  }

  async updateSettings(dto: Partial<CampaignSettings>): Promise<CampaignSettings> {
    await this.settings.setNamespace('cart_campaigns', dto);
    return this.getSettings();
  }

  async listTemplates(): Promise<CartCampaignTemplateDto[]> {
    const rows = await this.prisma.client.cartCampaignTemplate.findMany({ orderBy: { id: 'asc' } });
    return rows.map(toCartCampaignTemplateDto);
  }

  async createTemplate(dto: UpsertCampaignTemplateDto): Promise<CartCampaignTemplateDto> {
    const row = await this.prisma.client.cartCampaignTemplate.create({ data: dto });
    return toCartCampaignTemplateDto(row);
  }

  async updateTemplate(id: number, dto: Partial<UpsertCampaignTemplateDto>): Promise<CartCampaignTemplateDto> {
    const row = await this.prisma.client.cartCampaignTemplate.update({ where: { id }, data: dto });
    return toCartCampaignTemplateDto(row);
  }

  async deleteTemplate(id: number): Promise<void> {
    await this.prisma.client.cartCampaignTemplate.delete({ where: { id } });
  }

  // Called once, only when a NEW IncompleteOrder row is first captured
  // (RecoveryService) — not on every cart.updated re-upsert, since
  // scheduledAt is relative to the *original* abandonment moment, not the
  // latest cart edit. Idempotent via the unique(incompleteId, templateId,
  // channel) constraint regardless.
  async enqueueForIncomplete(incompleteId: number): Promise<void> {
    const [templates, incomplete] = await Promise.all([
      this.prisma.client.cartCampaignTemplate.findMany({ where: { status: 'ACTIVE' } }),
      this.prisma.client.incompleteOrder.findUnique({ where: { id: incompleteId } }),
    ]);
    if (!incomplete) return;

    for (const template of templates) {
      const recipient = template.channel === 'SMS' ? incomplete.phone : incomplete.email;
      if (!recipient) continue; // no contact info for this channel — nothing to enqueue

      const scheduledAt = new Date(incomplete.createdAt.getTime() + delayToMs(template.delayValue, template.delayUnit));
      await this.prisma.client.cartCampaignQueue.upsert({
        where: { incompleteId_templateId_channel: { incompleteId, templateId: template.id, channel: template.channel } },
        create: { incompleteId, templateId: template.id, channel: template.channel, recipient, scheduledAt },
        update: {},
      });
    }
  }

  // Stop condition (§C2) — called from RecoveryService when an
  // IncompleteOrder is marked recovered.
  async skipRemaining(incompleteId: number): Promise<void> {
    await this.prisma.client.cartCampaignQueue.updateMany({
      where: { incompleteId, status: 'PENDING' },
      data: { status: 'SKIPPED' },
    });
  }

  async listQueue(status?: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED'): Promise<CartCampaignQueueDto[]> {
    const rows = await this.prisma.client.cartCampaignQueue.findMany({
      where: status ? { status } : {},
      orderBy: { scheduledAt: 'desc' },
      take: 100,
    });
    return rows.map(toCartCampaignQueueDto);
  }

  async listLogs(): Promise<CartCampaignLogDto[]> {
    const rows = await this.prisma.client.cartCampaignLog.findMany({ orderBy: { sentAt: 'desc' }, take: 100 });
    return rows.map(toCartCampaignLogDto);
  }

  async cancelQueueItem(id: number): Promise<void> {
    await this.prisma.client.cartCampaignQueue.update({ where: { id }, data: { status: 'SKIPPED' } });
  }

  // Admin "retry" — sends immediately rather than just re-queuing for the
  // next cron tick, since an admin retrying a failed step wants to know
  // right away whether it worked.
  async retryQueueItem(id: number): Promise<void> {
    await this.prisma.client.cartCampaignQueue.update({
      where: { id },
      data: { status: 'PENDING', scheduledAt: new Date() },
    });
    await this.sendQueueItem(id);
  }

  // The worker (§G cron 1). ponytail: fixed 5-minute tick via @Cron, not a
  // fully dynamic admin-configurable interval — @Cron's expression is
  // compile-time; true runtime interval changes need SchedulerRegistry
  // re-registration, a real upgrade if the client ever needs a different
  // cadence than 5 minutes.
  @Cron(CronExpression.EVERY_5_MINUTES)
  async processQueue(): Promise<void> {
    const settings = await this.getSettings();
    if (!settings.enabled) return;

    const hour = new Date().getHours();
    const inQuietHours =
      settings.quietHoursStart < settings.quietHoursEnd
        ? hour >= settings.quietHoursStart && hour < settings.quietHoursEnd
        : hour >= settings.quietHoursStart || hour < settings.quietHoursEnd;
    if (inQuietHours) return;

    const due = await this.prisma.client.cartCampaignQueue.findMany({
      where: { status: 'PENDING', scheduledAt: { lte: new Date() }, attempts: { lt: settings.maxAttempts } },
      include: { template: true },
      take: 50,
    });

    for (const row of due) {
      if (row.template.status !== 'ACTIVE') {
        await this.prisma.client.cartCampaignQueue.update({ where: { id: row.id }, data: { status: 'SKIPPED' } });
        continue;
      }
      await this.sendQueueItem(row.id);
    }
    if (due.length > 0) this.logger.log(`Cart campaign worker processed ${due.length} due step(s)`);
  }

  async sendQueueItem(id: number): Promise<void> {
    const row = await this.prisma.client.cartCampaignQueue.findUniqueOrThrow({
      where: { id },
      include: { template: true },
    });
    if (!row.recipient) return;

    await this.prisma.client.cartCampaignQueue.update({ where: { id }, data: { lockedAt: new Date() } });

    const resumeUrl = `${this.config.get<string>('STOREFRONT_BASE_URL') ?? ''}/cart`;
    const body = renderBody(row.template.bodyEn, resumeUrl);

    let failed = false;
    let responseMsg: string | undefined;
    if (row.channel === 'SMS') {
      const smsResult = await this.sms.send(row.recipient, body, `cart_campaign_${row.templateId}`);
      failed = smsResult.status === 'FAILED';
      responseMsg = failed ? 'SMS send failed' : `sms_log_id:${smsResult.id}`;
    } else {
      const emailResult = await this.email.send(row.recipient, row.template.subject ?? 'Complete your order', body);
      failed = Boolean(emailResult.failed);
      responseMsg = emailResult.failed ? emailResult.error : emailResult.id;
    }

    const status = failed ? 'FAILED' : 'SENT';
    await this.prisma.client.cartCampaignQueue.update({
      where: { id },
      data: { status, attempts: { increment: 1 }, processedAt: new Date(), lastError: failed ? responseMsg : null },
    });
    await this.prisma.client.cartCampaignLog.create({
      data: {
        incompleteId: row.incompleteId,
        templateId: row.templateId,
        channel: row.channel,
        recipient: row.recipient,
        subject: row.template.subject,
        message: body,
        status,
        responseMsg,
      },
    });
  }
}
