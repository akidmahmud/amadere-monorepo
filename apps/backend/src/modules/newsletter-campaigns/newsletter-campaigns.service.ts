import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NewsletterCampaign, Prisma } from '@amader/db';
import { PaginatedResult } from '@amader/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { paginationArgs, toPaginatedResult } from '../../common/pagination.util';
import { EmailSettingsService } from '../email-settings/email-settings.service';
import { NewsletterSegmentsService } from '../newsletter-segments/newsletter-segments.service';
import { SmtpEmailProvider } from '../net-profit/cart-campaigns/providers/smtp-email.provider';
import {
  EMPTY_EMAIL_CONTENT,
  EmailContentJson,
  TRACKING_TOKEN_PLACEHOLDER,
  UNSUBSCRIBE_TOKEN_PLACEHOLDER,
  renderCampaignHtml,
  renderCampaignText,
} from '../../common/newsletter/email-renderer.util';
import { sanitizeCampaignHtml } from '../../common/newsletter/sanitize-campaign-html.util';
import { CreateCampaignDto, PreviewContentDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { AdminNewsletterCampaignDto, toAdminNewsletterCampaignDto } from './newsletter-campaigns.mapper';

// How many recipients one cron tick sends — a real SMTP connection per
// email, not a bulk API call, so this stays deliberately small (ponytail:
// fixed batch size, not admin-configurable throughput; revisit if a
// real transactional provider with a batch-send API replaces SMTP).
const BATCH_SIZE = 25;

export interface CampaignAnalytics {
  totalRecipients: number;
  totalSent: number;
  totalFailed: number;
  totalOpened: number;
  totalClicked: number;
  openRate: number | null;
  clickRate: number | null;
}

@Injectable()
export class NewsletterCampaignsService {
  private readonly logger = new Logger(NewsletterCampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly emailSettings: EmailSettingsService,
    private readonly emailProvider: SmtpEmailProvider,
    private readonly segments: NewsletterSegmentsService,
  ) {}

  async adminList(page: number, pageSize: number): Promise<PaginatedResult<AdminNewsletterCampaignDto>> {
    const [items, total] = await Promise.all([
      this.prisma.client.newsletterCampaign.findMany({
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.newsletterCampaign.count(),
    ]);
    return toPaginatedResult(items.map(toAdminNewsletterCampaignDto), total, page, pageSize);
  }

  async adminGet(id: number): Promise<AdminNewsletterCampaignDto> {
    return toAdminNewsletterCampaignDto(await this.getOrThrow(id));
  }

  async create(dto: CreateCampaignDto): Promise<AdminNewsletterCampaignDto> {
    const campaign = await this.prisma.client.newsletterCampaign.create({
      data: {
        name: dto.name,
        subject: dto.subject,
        previewText: dto.previewText,
        fromName: dto.fromName,
        fromEmail: dto.fromEmail,
        replyTo: dto.replyTo,
        segmentId: dto.segmentId,
        contentJson: this.toContentJson(dto.blocks, dto.mode, dto.html),
      },
    });
    return toAdminNewsletterCampaignDto(campaign);
  }

  async update(id: number, dto: UpdateCampaignDto): Promise<AdminNewsletterCampaignDto> {
    const existing = await this.getOrThrow(id);
    if (existing.status !== 'DRAFT') throw new ConflictException('Only draft campaigns can be edited');
    const contentChanged = dto.blocks !== undefined || dto.mode !== undefined || dto.html !== undefined;
    const campaign = await this.prisma.client.newsletterCampaign.update({
      where: { id },
      data: {
        name: dto.name,
        subject: dto.subject,
        previewText: dto.previewText,
        fromName: dto.fromName,
        fromEmail: dto.fromEmail,
        replyTo: dto.replyTo,
        segmentId: dto.segmentId,
        contentJson: contentChanged ? this.toContentJson(dto.blocks, dto.mode, dto.html) : undefined,
      },
    });
    return toAdminNewsletterCampaignDto(campaign);
  }

  // Stateless render, no persistence — used by the campaign/template editors
  // to show a live preview before (or after) saving.
  preview(dto: PreviewContentDto): { html: string; text: string } {
    const content = this.toRenderableContent(dto.blocks, dto.mode, dto.html);
    const html = renderCampaignHtml(content, {
      unsubscribeUrl: '#',
      // src="" on an <img> re-requests the current document in some
      // browsers — a harmless inline transparent pixel avoids that for a
      // preview that isn't tied to any real recipient/token.
      trackingPixelUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7',
      buildClickUrl: (target) => target,
    });
    return { html, text: renderCampaignText(content) };
  }

  async delete(id: number): Promise<void> {
    const existing = await this.getOrThrow(id);
    if (existing.status !== 'DRAFT') throw new ConflictException('Only draft campaigns can be deleted');
    await this.prisma.client.newsletterCampaign.delete({ where: { id } });
  }

  async sendTest(id: number, email: string): Promise<{ success: true }> {
    const campaign = await this.getOrThrow(id);
    const { fromName, fromEmail, replyTo } = await this.resolveSenderIdentity(campaign);
    const content = this.contentOf(campaign);
    const html = this.renderWithPlaceholders(content).replaceAll(TRACKING_TOKEN_PLACEHOLDER, 'test').replaceAll(UNSUBSCRIBE_TOKEN_PLACEHOLDER, 'test');
    const result = await this.emailProvider.send(email, `[TEST] ${campaign.subject}`, renderCampaignText(content), {
      html,
      fromName,
      fromEmail,
      replyTo,
    });
    if (result.failed) throw new BadRequestException(`Test send failed: ${result.error}`);
    return { success: true };
  }

  // Snapshots recipients for the resolved audience and flips the campaign
  // to SENDING. The cron worker below (@Cron) does the actual sending —
  // this returns immediately (spec §9: never send a real campaign inline
  // from the HTTP request). Shared by send() (immediate) and
  // promoteScheduled() (cron-driven) below.
  private async beginSending(campaign: NewsletterCampaign): Promise<void> {
    // Re-resolved here, immediately before creating recipients — not just
    // at some earlier point — per spec §25 ("do not assume the subscriber
    // was still subscribed when the campaign was created").
    const subscribers = await this.segments.resolveAudience(campaign.segmentId);
    if (subscribers.length === 0) throw new BadRequestException('No subscribers match this audience');

    await this.prisma.client.$transaction([
      // trackingToken is generated here explicitly, not left to a DB-level
      // default — createMany() doesn't reliably run Prisma's client-side
      // generator defaults (verified against this exact column: the P0
      // migration had to hand-add a raw-SQL DB default to paper over it,
      // which the P1 migration then had to drop again since it's the wrong
      // fix). Explicit generation is the correct, provider-independent one.
      this.prisma.client.newsletterCampaignRecipient.createMany({
        data: subscribers.map((s) => ({ campaignId: campaign.id, subscriberId: s.id, email: s.email, trackingToken: randomUUID() })),
      }),
      this.prisma.client.newsletterCampaign.update({
        where: { id: campaign.id },
        data: { status: 'SENDING', startedAt: new Date(), totalRecipients: subscribers.length },
      }),
    ]);
    this.logger.log(`Campaign #${campaign.id} "${campaign.name}" queued for ${subscribers.length} recipients`);
  }

  async send(id: number): Promise<AdminNewsletterCampaignDto> {
    const campaign = await this.getOrThrow(id);
    if (campaign.status !== 'DRAFT') throw new ConflictException('Only draft campaigns can be sent');
    const content = this.contentOf(campaign);
    if (this.isContentEmpty(content)) throw new BadRequestException('Campaign has no content');
    // Fail fast if there's no way to send at all, rather than flipping to
    // SENDING and silently stalling forever on the first cron tick.
    await this.resolveSenderIdentity(campaign);
    await this.beginSending(campaign);
    return this.adminGet(id);
  }

  async schedule(id: number, scheduledAt: Date): Promise<AdminNewsletterCampaignDto> {
    if (Number.isNaN(scheduledAt.getTime())) throw new BadRequestException('Invalid date');
    if (scheduledAt.getTime() <= Date.now()) throw new BadRequestException('Scheduled time must be in the future');
    const campaign = await this.getOrThrow(id);
    if (campaign.status !== 'DRAFT') throw new ConflictException('Only draft campaigns can be scheduled');
    const content = this.contentOf(campaign);
    if (this.isContentEmpty(content)) throw new BadRequestException('Campaign has no content');
    await this.resolveSenderIdentity(campaign);
    const updated = await this.prisma.client.newsletterCampaign.update({
      where: { id },
      data: { status: 'SCHEDULED', scheduledAt },
    });
    return toAdminNewsletterCampaignDto(updated);
  }

  async cancelSchedule(id: number): Promise<AdminNewsletterCampaignDto> {
    const campaign = await this.getOrThrow(id);
    if (campaign.status !== 'SCHEDULED') throw new ConflictException('Campaign is not scheduled');
    const updated = await this.prisma.client.newsletterCampaign.update({
      where: { id },
      data: { status: 'DRAFT', scheduledAt: null },
    });
    return toAdminNewsletterCampaignDto(updated);
  }

  // Promotes SCHEDULED campaigns whose time has come — spec §28 "a
  // background job checks scheduled campaigns and moves them to the
  // sending queue... do not depend only on a browser being open." Same
  // 1-minute cadence as the send worker below; a campaign scheduled at
  // 10:00 AM starts sending within a minute of it, not exactly on it.
  @Cron(CronExpression.EVERY_MINUTE)
  async promoteScheduled(): Promise<void> {
    const due = await this.prisma.client.newsletterCampaign.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() } },
    });
    for (const campaign of due) {
      try {
        await this.resolveSenderIdentity(campaign);
        await this.beginSending(campaign);
      } catch (err) {
        this.logger.warn(`Failed to promote scheduled campaign #${campaign.id}: ${err instanceof Error ? err.message : String(err)}`);
        await this.prisma.client.newsletterCampaign.update({ where: { id: campaign.id }, data: { status: 'FAILED' } });
      }
    }
  }

  async analytics(id: number): Promise<CampaignAnalytics> {
    const c = await this.getOrThrow(id);
    return {
      totalRecipients: c.totalRecipients,
      totalSent: c.totalSent,
      totalFailed: c.totalFailed,
      totalOpened: c.totalOpened,
      totalClicked: c.totalClicked,
      openRate: c.totalSent > 0 ? c.totalOpened / c.totalSent : null,
      clickRate: c.totalSent > 0 ? c.totalClicked / c.totalSent : null,
    };
  }

  // The worker (spec §9/§26). ponytail: fixed 1-minute tick + fixed
  // BATCH_SIZE via @Cron, the same shape as CartCampaignQueue's proven
  // 5-minute worker — not a BullMQ/Redis queue, this codebase has neither.
  // lockedAt claim prevents double-send if a tick overlaps a slow previous
  // run, same guard CartCampaignQueue already uses.
  @Cron(CronExpression.EVERY_MINUTE)
  async processQueue(): Promise<void> {
    const pending = await this.prisma.client.newsletterCampaignRecipient.findMany({
      where: { status: 'PENDING', lockedAt: null },
      take: BATCH_SIZE,
      include: { campaign: true },
    });
    if (pending.length === 0) return;

    const now = new Date();
    await this.prisma.client.newsletterCampaignRecipient.updateMany({
      where: { id: { in: pending.map((r) => r.id) } },
      data: { lockedAt: now },
    });

    const touchedCampaignIds = new Set<number>();
    for (const recipient of pending) {
      touchedCampaignIds.add(recipient.campaignId);
      await this.sendOne(recipient);
    }
    for (const campaignId of touchedCampaignIds) {
      await this.maybeCompleteCampaign(campaignId);
    }
  }

  private async sendOne(
    recipient: Prisma.NewsletterCampaignRecipientGetPayload<{ include: { campaign: true } }>,
  ): Promise<void> {
    const { campaign } = recipient;
    try {
      const { fromName, fromEmail, replyTo } = await this.resolveSenderIdentity(campaign);
      const content = this.contentOf(campaign);
      const html = this.renderWithPlaceholders(content)
        .replaceAll(TRACKING_TOKEN_PLACEHOLDER, recipient.trackingToken)
        .replaceAll(UNSUBSCRIBE_TOKEN_PLACEHOLDER, await this.unsubscribeTokenFor(recipient.subscriberId, recipient.email));
      const result = await this.emailProvider.send(recipient.email, campaign.subject, renderCampaignText(content), {
        html,
        fromName,
        fromEmail,
        replyTo,
      });
      await this.prisma.client.newsletterCampaignRecipient.update({
        where: { id: recipient.id },
        data: result.failed
          ? { status: 'FAILED', attempts: { increment: 1 }, lockedAt: null, errorMessage: result.error }
          : { status: 'SENT', attempts: { increment: 1 }, lockedAt: null, sentAt: new Date(), providerMessageId: result.id },
      });
      if (result.failed) {
        await this.prisma.client.newsletterCampaign.update({ where: { id: campaign.id }, data: { totalFailed: { increment: 1 } } });
      } else {
        await this.prisma.client.newsletterCampaign.update({ where: { id: campaign.id }, data: { totalSent: { increment: 1 } } });
      }
    } catch (err) {
      this.logger.warn(`Newsletter send failed for recipient #${recipient.id}: ${err instanceof Error ? err.message : String(err)}`);
      await this.prisma.client.newsletterCampaignRecipient.update({
        where: { id: recipient.id },
        data: { status: 'FAILED', attempts: { increment: 1 }, lockedAt: null, errorMessage: err instanceof Error ? err.message : 'Unknown error' },
      });
      await this.prisma.client.newsletterCampaign.update({ where: { id: campaign.id }, data: { totalFailed: { increment: 1 } } });
    }
  }

  private async maybeCompleteCampaign(campaignId: number): Promise<void> {
    const stillPending = await this.prisma.client.newsletterCampaignRecipient.count({
      where: { campaignId, status: 'PENDING' },
    });
    if (stillPending > 0) return;
    const [sent, failed] = await Promise.all([
      this.prisma.client.newsletterCampaignRecipient.count({ where: { campaignId, status: 'SENT' } }),
      this.prisma.client.newsletterCampaignRecipient.count({ where: { campaignId, status: 'FAILED' } }),
    ]);
    const status = sent === 0 ? 'FAILED' : failed === 0 ? 'SENT' : 'PARTIALLY_SENT';
    await this.prisma.client.newsletterCampaign.update({
      where: { id: campaignId },
      data: { status, completedAt: new Date() },
    });
  }

  // Public tracking/unsubscribe endpoints call these directly.
  async recordOpen(trackingToken: string): Promise<void> {
    const recipient = await this.prisma.client.newsletterCampaignRecipient.findUnique({ where: { trackingToken } });
    if (!recipient || recipient.openedAt) return; // unknown token, or already counted — idempotent
    await this.prisma.client.$transaction([
      this.prisma.client.newsletterCampaignRecipient.update({ where: { id: recipient.id }, data: { openedAt: new Date() } }),
      this.prisma.client.newsletterCampaign.update({ where: { id: recipient.campaignId }, data: { totalOpened: { increment: 1 } } }),
    ]);
  }

  async recordClick(trackingToken: string): Promise<void> {
    const recipient = await this.prisma.client.newsletterCampaignRecipient.findUnique({ where: { trackingToken } });
    if (!recipient || recipient.clickedAt) return;
    await this.prisma.client.$transaction([
      this.prisma.client.newsletterCampaignRecipient.update({ where: { id: recipient.id }, data: { clickedAt: new Date() } }),
      this.prisma.client.newsletterCampaign.update({ where: { id: recipient.campaignId }, data: { totalClicked: { increment: 1 } } }),
    ]);
  }

  private async getOrThrow(id: number): Promise<NewsletterCampaign> {
    const campaign = await this.prisma.client.newsletterCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  private contentOf(campaign: NewsletterCampaign): EmailContentJson {
    return (campaign.contentJson as unknown as EmailContentJson) ?? EMPTY_EMAIL_CONTENT;
  }

  private isContentEmpty(content: EmailContentJson): boolean {
    return content.mode === 'html' ? !content.html : content.blocks.length === 0;
  }

  private toRenderableContent(
    blocks: CreateCampaignDto['blocks'],
    mode: CreateCampaignDto['mode'],
    html: CreateCampaignDto['html'],
  ): EmailContentJson {
    return {
      version: 1,
      mode: mode ?? 'blocks',
      blocks: blocks ?? [],
      html: mode === 'html' && html ? sanitizeCampaignHtml(html) : undefined,
    };
  }

  private toContentJson(
    blocks: CreateCampaignDto['blocks'],
    mode: CreateCampaignDto['mode'],
    html: CreateCampaignDto['html'],
  ): Prisma.InputJsonValue {
    return this.toRenderableContent(blocks, mode, html) as unknown as Prisma.InputJsonValue;
  }

  private apiBaseUrl(): string {
    return this.config.get<string>('API_BASE_URL') ?? 'http://localhost:3000';
  }

  private renderWithPlaceholders(content: EmailContentJson): string {
    const base = this.apiBaseUrl();
    return renderCampaignHtml(content, {
      unsubscribeUrl: `${base}/newsletter/unsubscribe/${UNSUBSCRIBE_TOKEN_PLACEHOLDER}`,
      trackingPixelUrl: `${base}/newsletter/track/open/${TRACKING_TOKEN_PLACEHOLDER}`,
      buildClickUrl: (target) => `${base}/newsletter/track/click/${TRACKING_TOKEN_PLACEHOLDER}?url=${encodeURIComponent(target)}`,
    });
  }

  private async unsubscribeTokenFor(subscriberId: number | null, email: string): Promise<string> {
    if (subscriberId) {
      const s = await this.prisma.client.newsletterSubscriber.findUnique({ where: { id: subscriberId } });
      if (s) return s.unsubscribeToken;
    }
    // Historical recipient row whose subscriber was deleted — fall back to
    // a lookup by the snapshotted email so the link still resolves.
    const s = await this.prisma.client.newsletterSubscriber.findUnique({ where: { email } });
    return s?.unsubscribeToken ?? 'invalid';
  }

  private async resolveSenderIdentity(campaign: NewsletterCampaign): Promise<{ fromName?: string; fromEmail: string; replyTo?: string }> {
    const settings = await this.emailSettings.getConfig();
    const fromEmail = campaign.fromEmail || settings.senderEmail;
    if (!fromEmail) {
      throw new BadRequestException('No sender email configured — set one on the campaign or in Settings > Email');
    }
    return {
      fromName: campaign.fromName || settings.senderName || undefined,
      fromEmail,
      replyTo: campaign.replyTo ?? undefined,
    };
  }
}
