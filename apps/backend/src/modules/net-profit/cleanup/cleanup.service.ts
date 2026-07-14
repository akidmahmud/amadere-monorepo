import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NetProfitSettingsService } from '../settings/net-profit-settings.service';
import { BlockerService } from '../blocker/blocker.service';

export interface CleanupSettings {
  enabled: boolean;
  otpRetentionDays: number;
  incompleteOrderRetentionDays: number;
  logRetentionDays: number;
}

const DEFAULTS: CleanupSettings = {
  enabled: true,
  otpRetentionDays: 7,
  incompleteOrderRetentionDays: 30,
  logRetentionDays: 90,
};

export interface CleanupResult {
  expiredBlocks: number;
  otps: number;
  incompleteOrders: number;
  smsLogs: number;
  campaignLogs: number;
  auditLogs: number;
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

// ADDENDUM §G cron 4 — cleanup/retention. Prunes expired blocks (delegates
// to BlockerService, the owner of that table) plus aged rows in a handful
// of other tables directly via Prisma; each retention window is
// independently configurable and the whole job is behind one `enabled` flag.
@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: NetProfitSettingsService,
    private readonly blocker: BlockerService,
  ) {}

  async getSettings(): Promise<CleanupSettings> {
    return this.settings.getNamespace('cleanup', DEFAULTS);
  }

  async updateSettings(dto: Partial<CleanupSettings>): Promise<CleanupSettings> {
    await this.settings.setNamespace('cleanup', dto);
    return this.getSettings();
  }

  async runNow(): Promise<CleanupResult> {
    const cfg = await this.getSettings();

    const [expiredBlocks, otps, incompleteOrders, smsLogs, campaignLogs, auditLogs] = await Promise.all([
      this.blocker.pruneExpired(),
      this.prisma.client.otp
        .deleteMany({ where: { expiresAt: { lt: daysAgo(cfg.otpRetentionDays) } } })
        .then((r) => r.count),
      this.prisma.client.incompleteOrder
        .deleteMany({ where: { recovered: false, lastSeenAt: { lt: daysAgo(cfg.incompleteOrderRetentionDays) } } })
        .then((r) => r.count),
      this.prisma.client.smsLog
        .deleteMany({ where: { createdAt: { lt: daysAgo(cfg.logRetentionDays) } } })
        .then((r) => r.count),
      this.prisma.client.cartCampaignLog
        .deleteMany({ where: { sentAt: { lt: daysAgo(cfg.logRetentionDays) } } })
        .then((r) => r.count),
      this.prisma.client.auditLog
        .deleteMany({ where: { createdAt: { lt: daysAgo(cfg.logRetentionDays) } } })
        .then((r) => r.count),
    ]);

    const result = { expiredBlocks, otps, incompleteOrders, smsLogs, campaignLogs, auditLogs };
    this.logger.log(`Cleanup run: ${JSON.stringify(result)}`);
    return result;
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async dailyCleanup(): Promise<void> {
    const cfg = await this.getSettings();
    if (!cfg.enabled) return;
    await this.runNow();
  }
}
