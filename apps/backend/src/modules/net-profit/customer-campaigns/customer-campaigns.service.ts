import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import { DelayUnit, Locale } from '@amader/db';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { SmtpEmailProvider } from '../cart-campaigns/providers/smtp-email.provider';
import { NetProfitSettingsService } from '../settings/net-profit-settings.service';
import { CUSTOMER_CREATED_EVENT } from '../../customers/customers.events';
import type { CustomerCreatedEvent } from '../../customers/customers.events';

export interface CustomerCampaignSettings {
  enabled: boolean;
  maxAttempts: number;
  /** Nobody wants a marketing SMS at 3am. Hours are local, [start, end). */
  quietHoursStart: number;
  quietHoursEnd: number;
  /** Cap on how many customers one recurring scan may enrol. */
  recurringBatchSize: number;
}

const SETTINGS_KEY = 'customer_campaigns';
const DEFAULTS: CustomerCampaignSettings = {
  // Off by default. Turning this on starts messaging real customers, so it
  // is an explicit decision, never a side effect of deploying.
  enabled: false,
  maxAttempts: 3,
  quietHoursStart: 22,
  quietHoursEnd: 8,
  recurringBatchSize: 200,
};

function delayToMs(value: number, unit: DelayUnit): number {
  const perUnit = { MINUTE: 60_000, HOUR: 3_600_000, DAY: 86_400_000 } as const;
  return value * perUnit[unit];
}

/**
 * Welcome/onboarding campaigns aimed at customers, by email and/or SMS.
 *
 * Same shape as CartCampaignsService — templates with a delay, a queue table
 * the worker drains — but triggered by "a customer was added" instead of "a
 * cart was abandoned", and addressed to a Customer rather than a newsletter
 * subscriber. That last part is the whole point: someone who ordered but
 * never ticked the newsletter box is invisible to the newsletter engine.
 */
@Injectable()
export class CustomerCampaignsService {
  private readonly logger = new Logger(CustomerCampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: NetProfitSettingsService,
    private readonly sms: SmsService,
    private readonly email: SmtpEmailProvider,
  ) {}

  getSettings(): Promise<CustomerCampaignSettings> {
    return this.settings.get<CustomerCampaignSettings>(SETTINGS_KEY, DEFAULTS);
  }

  async updateSettings(dto: Partial<CustomerCampaignSettings>): Promise<CustomerCampaignSettings> {
    const next = { ...(await this.getSettings()), ...dto };
    await this.settings.set(SETTINGS_KEY, next);
    return next;
  }

  // ---------------------------------------------------------------- templates

  listTemplates() {
    return this.prisma.client.customerCampaignTemplate.findMany({
      orderBy: [{ delayUnit: 'asc' }, { delayValue: 'asc' }, { id: 'asc' }],
    });
  }

  createTemplate(data: {
    channel: 'EMAIL' | 'SMS';
    name: string;
    subject?: string | null;
    bodyEn: string;
    bodyBn: string;
    delayValue: number;
    delayUnit: DelayUnit;
    status?: 'ACTIVE' | 'PAUSED';
  }) {
    return this.prisma.client.customerCampaignTemplate.create({ data });
  }

  updateTemplate(id: number, data: Record<string, unknown>) {
    return this.prisma.client.customerCampaignTemplate.update({ where: { id }, data });
  }

  async deleteTemplate(id: number): Promise<void> {
    await this.prisma.client.customerCampaignTemplate.delete({ where: { id } });
  }

  // ------------------------------------------------------------------ enqueue

  /** The trigger. Listening rather than being called directly keeps
   *  CustomersService free of any dependency on this engine. */
  @OnEvent(CUSTOMER_CREATED_EVENT)
  onCustomerCreated(event: CustomerCreatedEvent): Promise<void> {
    return this.enqueueForCustomer(event.customerId);
  }

  /**
   * Called when a customer is added. Never throws: a campaign step failing to
   * queue must not take down the customer creation that triggered it.
   *
   * Safe to call twice — the unique index on (customer, template, channel)
   * makes a repeat a no-op rather than a duplicate message.
   */
  async enqueueForCustomer(customerId: number): Promise<void> {
    try {
      const settings = await this.getSettings();
      if (!settings.enabled) return;

      const customer = await this.prisma.client.customer.findUnique({
        where: { id: customerId },
        select: { id: true, email: true, phone: true, createdAt: true },
      });
      if (!customer) return;

      const templates = await this.prisma.client.customerCampaignTemplate.findMany({
        // Recurring templates are driven by the daily scan, not by signup —
        // enrolling a brand-new customer in one here would send them a
        // "we miss you" the moment they join.
        where: { status: 'ACTIVE', trigger: 'CUSTOMER_ADDED' },
      });
      if (templates.length === 0) return;

      const base = customer.createdAt.getTime();
      const rows = templates
        .map((t) => ({
          customerId,
          templateId: t.id,
          channel: t.channel,
          // Snapshotted now, so editing the profile later cannot redirect a
          // message that is already queued.
          recipient: t.channel === 'SMS' ? customer.phone : customer.email,
          scheduledAt: new Date(base + delayToMs(t.delayValue, t.delayUnit)),
        }))
        // No address for this channel means nothing to send. Skipped at
        // enqueue rather than queued and failed later, so the queue stays a
        // list of things that can actually go out.
        .filter((r) => Boolean(r.recipient));

      if (rows.length === 0) return;
      await this.prisma.client.customerCampaignQueue.createMany({
        data: rows,
        skipDuplicates: true,
      });
      this.logger.log(`Queued ${rows.length} campaign step(s) for customer ${customerId}`);
    } catch (err) {
      this.logger.warn(
        `Could not queue customer campaign for ${customerId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // --------------------------------------------------------------- recurring

  /**
   * Enrols everyone a RECURRING template targets, once a day.
   *
   * Daily rather than every 5 minutes on purpose: the audience is "customers
   * with no order in 30 days", which cannot meaningfully change between
   * breakfast and lunch, and scanning the customer table every 5 minutes to
   * discover that would be pure waste.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scanRecurring(): Promise<void> {
    const settings = await this.getSettings();
    if (!settings.enabled) return;

    const templates = await this.prisma.client.customerCampaignTemplate.findMany({
      where: { status: 'ACTIVE', trigger: 'RECURRING' },
    });

    for (const t of templates) {
      try {
        await this.enrolRecurring(t, settings.recurringBatchSize);
      } catch (err) {
        this.logger.warn(
          `Recurring scan failed for template ${t.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  private async enrolRecurring(template: {
    id: number;
    channel: 'EMAIL' | 'SMS' | 'WEB_PUSH';
    audience: 'ALL' | 'NO_ORDER_IN_DAYS';
    audienceDays: number | null;
    repeatEveryDays: number | null;
    delayValue: number;
    delayUnit: DelayUnit;
  }, batchSize: number): Promise<void> {
    const now = new Date();
    // One bucket per day. Combined with the unique index this makes a second
    // run on the same day a no-op rather than a second message.
    const cycleKey = now.toISOString().slice(0, 10);

    // The cool-off. Without a repeat interval a recurring template would
    // re-enrol the same person every single day, so treat a missing value as
    // "never repeat" rather than "repeat constantly".
    const cooloffDays = template.repeatEveryDays ?? 0;
    if (cooloffDays <= 0) {
      this.logger.warn(`Recurring template ${template.id} has no repeatEveryDays — skipping`);
      return;
    }
    const cooloffSince = new Date(now.getTime() - cooloffDays * 86_400_000);

    const staleSince =
      template.audience === 'NO_ORDER_IN_DAYS'
        ? new Date(now.getTime() - (template.audienceDays ?? 30) * 86_400_000)
        : null;

    const candidates = await this.prisma.client.customer.findMany({
      where: {
        // Someone with no address for this channel can never be reached, so
        // they are excluded here rather than queued and failed later.
        ...(template.channel === 'SMS' ? { phone: { not: null } } : { email: { not: null } }),
        // Not already messaged by this template inside the cool-off.
        campaignQueue: {
          none: { templateId: template.id, createdAt: { gte: cooloffSince } },
        },
        ...(staleSince
          ? { orders: { none: { createdAt: { gte: staleSince }, deletedAt: null } } }
          : {}),
      },
      select: { id: true, email: true, phone: true },
      // Capped per run. A first scan against a large customer table would
      // otherwise queue tens of thousands of messages in one go — a real bill
      // and a deliverability problem. The rest are picked up tomorrow.
      take: batchSize,
    });

    if (candidates.length === 0) return;

    const scheduledAt = new Date(now.getTime() + delayToMs(template.delayValue, template.delayUnit));
    await this.prisma.client.customerCampaignQueue.createMany({
      data: candidates.map((c) => ({
        customerId: c.id,
        templateId: template.id,
        channel: template.channel,
        recipient: template.channel === 'SMS' ? c.phone : c.email,
        scheduledAt,
        cycleKey,
      })),
      skipDuplicates: true,
    });
    this.logger.log(
      `Recurring template ${template.id} enrolled ${candidates.length} customer(s) for ${cycleKey}`,
    );
  }

  // ------------------------------------------------------------------- queue

  listQueue(status?: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED') {
    return this.prisma.client.customerCampaignQueue.findMany({
      where: status ? { status } : undefined,
      include: { template: { select: { name: true, channel: true } } },
      orderBy: { scheduledAt: 'desc' },
      take: 200,
    });
  }

  async cancelQueueItem(id: number): Promise<void> {
    await this.prisma.client.customerCampaignQueue.update({
      where: { id },
      data: { status: 'SKIPPED' },
    });
  }

  // ------------------------------------------------------------------ worker

  /** Same fixed 5-minute tick as the cart worker — a delay measured in
   *  minutes does not need finer resolution than that. */
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

    const due = await this.prisma.client.customerCampaignQueue.findMany({
      where: {
        status: 'PENDING',
        scheduledAt: { lte: new Date() },
        attempts: { lt: settings.maxAttempts },
      },
      include: { template: true },
      take: 50,
    });

    for (const row of due) {
      // A template paused after its steps were queued must not still fire.
      if (row.template.status !== 'ACTIVE') {
        await this.prisma.client.customerCampaignQueue.update({
          where: { id: row.id },
          data: { status: 'SKIPPED' },
        });
        continue;
      }
      await this.sendQueueItem(row.id);
    }
    if (due.length > 0) {
      this.logger.log(`Customer campaign worker processed ${due.length} due step(s)`);
    }
  }

  async sendQueueItem(id: number, locale: Locale = 'EN'): Promise<void> {
    const row = await this.prisma.client.customerCampaignQueue.findUniqueOrThrow({
      where: { id },
      include: { template: true, customer: { select: { firstName: true, lastName: true } } },
    });
    if (!row.recipient) return;

    // Claim it before sending, so an overlapping tick cannot send it twice.
    await this.prisma.client.customerCampaignQueue.update({
      where: { id },
      data: { lockedAt: new Date(), attempts: { increment: 1 } },
    });

    const name = [row.customer.firstName, row.customer.lastName].filter(Boolean).join(' ').trim();
    // Deliberately a small substitution rather than the full MergeTagsService:
    // that one resolves cart/order context this trigger simply does not have.
    //
    // Both spellings on purpose. The rest of the codebase (recovery, cart
    // campaigns) uses {{firstName}}/{{customerName}}, so a template written
    // there has to keep working if it is pasted in here — silently rendering
    // an empty name because the screen wanted different casing is exactly the
    // kind of thing nobody notices until it has mailed a thousand people.
    const first = row.customer.firstName || 'there';
    const full = name || 'there';
    const fill = (text: string) =>
      text
        .replaceAll('{{customerName}}', full)
        .replaceAll('{{firstName}}', first)
        .replaceAll('{{name}}', full)
        .replaceAll('{{first_name}}', first);

    const body = fill(locale === 'BN' ? row.template.bodyBn : row.template.bodyEn);
    const rawHtml = locale === 'BN' ? row.template.bodyHtmlBn : row.template.bodyHtmlEn;
    const html = rawHtml?.trim() ? fill(rawHtml) : undefined;

    let failed = false;
    let error: string | undefined;
    try {
      if (row.channel === 'SMS') {
        const result = await this.sms.send(row.recipient, body, `customer_campaign_${row.templateId}`);
        failed = result.status === 'FAILED';
        if (failed) error = 'SMS send failed';
      } else {
        // `body` still goes as the text/plain part even when html is set —
        // some clients block HTML, and a mail with no text alternative scores
        // worse with spam filters.
        const result = await this.email.send(
          row.recipient,
          row.template.subject ?? 'Welcome to Amader™',
          body,
          html ? { html } : undefined,
        );
        failed = result.failed === true;
        if (failed) error = result.error ?? 'Email send failed';
      }
    } catch (err) {
      failed = true;
      error = err instanceof Error ? err.message : String(err);
    }

    await this.prisma.client.customerCampaignQueue.update({
      where: { id },
      data: {
        status: failed ? 'FAILED' : 'SENT',
        processedAt: new Date(),
        lastError: error ?? null,
        lockedAt: null,
      },
    });
  }
}
