import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@amader/db';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NetProfitSettingsService } from '../settings/net-profit-settings.service';
import { SalesReportService } from '../sales-report/sales-report.service';
import { SmtpEmailProvider } from '../cart-campaigns/providers/smtp-email.provider';
import { MarketingCostDto, toMarketingCostDto } from './marketing-cost.mapper';

const Decimal = Prisma.Decimal;

export function dayKey(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export interface MarketingCostSettings {
  autoCarryEnabled: boolean;
  defaultMarketingCost: number;
  autoReportEnabled: boolean;
  reportEmail: string;
}

const SETTINGS_NAMESPACE = 'marketingCost';
const SETTINGS_DEFAULTS: MarketingCostSettings = {
  autoCarryEnabled: false,
  defaultMarketingCost: 0,
  autoReportEnabled: false,
  reportEmail: '',
};

// ADDENDUM §D — day-level marketing-cost ledger. Separate table from
// OrderProfit's per-order `adSpend` (base spec §7.10); this is the daily
// total the plugin's Overview/Profit dashboards actually read.
@Injectable()
export class MarketingCostService {
  private readonly logger = new Logger(MarketingCostService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: NetProfitSettingsService,
    private readonly salesReport: SalesReportService,
    private readonly email: SmtpEmailProvider,
  ) {}

  async getSettings(): Promise<MarketingCostSettings> {
    return this.settings.getNamespace(SETTINGS_NAMESPACE, SETTINGS_DEFAULTS);
  }

  async updateSettings(dto: Partial<MarketingCostSettings>): Promise<MarketingCostSettings> {
    await this.settings.setNamespace(SETTINGS_NAMESPACE, dto);
    return this.getSettings();
  }

  async upsert(date: Date, adsCost: number, otherCost: number, note?: string): Promise<MarketingCostDto> {
    const costDate = dayKey(date);
    const row = await this.prisma.client.marketingCost.upsert({
      where: { costDate },
      create: { costDate, adsCost: new Decimal(adsCost), otherCost: new Decimal(otherCost), note, autoCarried: false },
      update: { adsCost: new Decimal(adsCost), otherCost: new Decimal(otherCost), note, autoCarried: false },
    });
    return toMarketingCostDto(row);
  }

  async getForDate(date: Date): Promise<MarketingCostDto | null> {
    const row = await this.prisma.client.marketingCost.findUnique({ where: { costDate: dayKey(date) } });
    return row ? toMarketingCostDto(row) : null;
  }

  async list(from: Date, to: Date): Promise<MarketingCostDto[]> {
    const rows = await this.prisma.client.marketingCost.findMany({
      where: { costDate: { gte: dayKey(from), lte: dayKey(to) } },
      orderBy: { costDate: 'asc' },
    });
    return rows.map(toMarketingCostDto);
  }

  // Cron 2 of §G — daily carry-forward: if today has no entry yet, copy the
  // most recent prior day's costs so ad spend doesn't silently drop to zero
  // on days the admin forgets to log it.
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async carryForward(): Promise<void> {
    const settings = await this.getSettings();
    if (!settings.autoCarryEnabled) return;

    const today = dayKey(new Date());
    const existing = await this.prisma.client.marketingCost.findUnique({ where: { costDate: today } });
    if (existing) return;

    const last = await this.prisma.client.marketingCost.findFirst({
      where: { costDate: { lt: today } },
      orderBy: { costDate: 'desc' },
    });
    if (!last) return;

    await this.prisma.client.marketingCost.create({
      data: { costDate: today, adsCost: last.adsCost, otherCost: last.otherCost, note: last.note, autoCarried: true },
    });
    this.logger.log(`Carried marketing cost forward to ${today.toISOString().slice(0, 10)}`);
  }

  // Plugin parity ("Auto Report Delivery") — CSV embedded in the email body
  // rather than a real attachment, since SmtpEmailProvider (shared with Cart
  // Abandonment's campaign emails) only sends plain text, no MIME parts.
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async sendDailyReport(): Promise<void> {
    const settings = await this.getSettings();
    if (!settings.autoReportEnabled || !settings.reportEmail) return;

    const yesterday = new Date(dayKey(new Date()).getTime() - 86_400_000);
    const csv = await this.salesReport.exportCsv('day', yesterday, yesterday);
    const dateLabel = yesterday.toISOString().slice(0, 10);
    const result = await this.email.send(settings.reportEmail, `Sales report — ${dateLabel}`, csv);
    if (result.failed) {
      this.logger.warn(`Daily sales report email to ${settings.reportEmail} failed: ${result.error}`);
    } else {
      this.logger.log(`Daily sales report emailed to ${settings.reportEmail} for ${dateLabel}`);
    }
  }
}
