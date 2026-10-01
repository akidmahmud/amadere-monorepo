import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@amader/db';
import type {
  DailyReportDetail,
  DailyReportKind,
  DailyReportListItem,
  DailyReportSettings,
  DailyReportSettingsView,
  DailyReportSnapshot,
} from '@amader/shared';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NetProfitSettingsService } from '../settings/net-profit-settings.service';
import { buildSnapshot } from './build';
import { DailyReportLoader } from './daily-report.loader';
import {
  autoName,
  currentBusinessDay,
  lastClosedBusinessDay,
  validateManual,
} from './period';
import {
  DEFAULT_SETTINGS,
  allSourceDefs,
  resolveSources,
  validateSettings,
} from './settings';

const NS = 'daily_report';
const RETENTION_DAYS = 45;
const DAY_MS = 86_400_000;
const day = (d: Date) => d.toISOString().slice(0, 10);
const utc = (s: string) => new Date(`${s}T00:00:00Z`);

const LIST_SELECT = {
  id: true,
  name: true,
  kind: true,
  periodFrom: true,
  periodTo: true,
  totalSales: true,
  netProfit: true,
  createdByName: true,
  createdAt: true,
} satisfies Prisma.DailyReportSelect;
type ListRow = Prisma.DailyReportGetPayload<{ select: typeof LIST_SELECT }>;

const toListItem = (r: ListRow): DailyReportListItem => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  from: day(r.periodFrom),
  to: day(r.periodTo),
  totalSales: Number(r.totalSales),
  netProfit: Number(r.netProfit),
  createdByName: r.createdByName,
  createdAt: r.createdAt.toISOString(),
});

@Injectable()
export class DailyReportService {
  private readonly logger = new Logger(DailyReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly loader: DailyReportLoader,
    private readonly settings: NetProfitSettingsService,
  ) {}

  // ---- settings ----------------------------------------------------------

  async getSettings(): Promise<DailyReportSettingsView> {
    const [stored, channels] = await Promise.all([
      this.settings.getNamespace<DailyReportSettings>(NS, DEFAULT_SETTINGS),
      this.prisma.client.wholesaleChannel.findMany({
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true },
      }),
    ]);
    return {
      ...stored,
      sources: resolveSources(stored.sources, allSourceDefs(channels)),
    };
  }

  async putSettings(input: unknown): Promise<DailyReportSettingsView> {
    let s: DailyReportSettings;
    try {
      s = validateSettings(input);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    await this.settings.set(`${NS}.autoEnabled`, s.autoEnabled);
    await this.settings.set(`${NS}.sources`, s.sources);
    await this.settings.set(`${NS}.fixedCosts`, s.fixedCosts);
    return this.getSettings();
  }

  // ---- generation --------------------------------------------------------

  async generateManual(
    dto: { name: string; from: string; to: string },
    adminId: number,
  ): Promise<DailyReportListItem> {
    let name: string;
    try {
      name = validateManual(
        dto.name,
        dto.from,
        dto.to,
        currentBusinessDay(new Date()),
      );
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    const admin = await this.prisma.client.adminUser.findUnique({
      where: { id: adminId },
      select: { firstName: true, lastName: true, email: true },
    });
    const who = admin
      ? `${admin.firstName ?? ''} ${admin.lastName ?? ''}`.trim() || admin.email
      : `#${adminId}`;
    return this.generate({
      name,
      from: dto.from,
      to: dto.to,
      kind: 'MANUAL',
      createdById: adminId,
      createdByName: who,
    });
  }

  /** Yesterday's (or any day's) AUTO report; null when it already exists. */
  async generateAuto(d: string): Promise<DailyReportListItem | null> {
    const exists = await this.prisma.client.dailyReport.findFirst({
      where: { kind: 'AUTO', periodFrom: utc(d) },
      select: { id: true },
    });
    if (exists) return null;
    try {
      return await this.generate({
        name: autoName(d),
        from: d,
        to: d,
        kind: 'AUTO',
        createdById: null,
        createdByName: null,
      });
    } catch (e) {
      // The partial unique index lost a race with another instance: already done.
      if ((e as { code?: string }).code === 'P2002') return null;
      throw e;
    }
  }

  private async generate(p: {
    name: string;
    from: string;
    to: string;
    kind: DailyReportKind;
    createdById: number | null;
    createdByName: string | null;
  }): Promise<DailyReportListItem> {
    const db = this.prisma.client;
    const [settings, orders, mk] = await Promise.all([
      this.getSettings(),
      this.loader.load(p.from, p.to),
      db.marketingCost.aggregate({
        where: { costDate: { gte: utc(p.from), lte: utc(p.to) } },
        _sum: { adsCost: true, otherCost: true },
      }),
    ]);
    const snapshot = buildSnapshot({
      from: p.from,
      to: p.to,
      generatedAt: new Date().toISOString(),
      orders,
      sources: settings.sources,
      fixedCosts: settings.fixedCosts,
      marketing: Number(mk._sum.adsCost ?? 0) + Number(mk._sum.otherCost ?? 0),
    });
    const row = await db.dailyReport.create({
      data: {
        name: p.name,
        kind: p.kind,
        periodFrom: utc(p.from),
        periodTo: utc(p.to),
        payload: snapshot as unknown as Prisma.InputJsonValue,
        totalSales: snapshot.grandTotal.sales,
        netProfit: snapshot.netProfit,
        createdById: p.createdById,
        createdByName: p.createdByName,
      },
      select: LIST_SELECT,
    });
    return toListItem(row);
  }

  // 8:15 PM Dhaka, just after the 8 PM business-day close, then retried hourly
  // until 11:15 PM: a restart or DB blip must not leave a day with no report.
  // generateAuto is idempotent, so the retries are no-ops once the day exists.
  @Cron('0 15 20-23 * * *', { timeZone: 'Asia/Dhaka' })
  async nightly(): Promise<void> {
    // Separate try: a failed purge must not stop the report.
    try {
      const purged = await this.purge();
      if (purged)
        this.logger.log(
          `Deleted ${purged} daily report(s) older than ${RETENTION_DAYS} days`,
        );
    } catch (e) {
      this.logger.error('Daily report purge failed', e as Error);
    }
    try {
      const { autoEnabled } =
        await this.settings.getNamespace<DailyReportSettings>(
          NS,
          DEFAULT_SETTINGS,
        );
      if (!autoEnabled) return;
      const made = await this.generateAuto(lastClosedBusinessDay(new Date()));
      if (made) this.logger.log(`Generated ${made.name}`);
    } catch (e) {
      this.logger.error('Nightly daily report failed', e as Error);
    }
  }

  async purge(): Promise<number> {
    const { count } = await this.prisma.client.dailyReport.deleteMany({
      where: {
        createdAt: { lt: new Date(Date.now() - RETENTION_DAYS * DAY_MS) },
      },
    });
    return count;
  }

  // ---- read / delete -----------------------------------------------------

  async list(q: {
    date?: string;
    q?: string;
    page?: number;
    pageSize?: number;
  }) {
    const where: Prisma.DailyReportWhereInput = {};
    if (q.date) {
      where.periodFrom = { lte: utc(q.date) };
      where.periodTo = { gte: utc(q.date) };
    }
    if (q.q?.trim()) where.name = { contains: q.q.trim(), mode: 'insensitive' };
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 30;
    const [rows, total] = await Promise.all([
      this.prisma.client.dailyReport.findMany({
        where,
        select: LIST_SELECT,
        orderBy: [{ periodFrom: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.client.dailyReport.count({ where }),
    ]);
    return { items: rows.map(toListItem), total, page, pageSize };
  }

  async get(id: number): Promise<DailyReportDetail> {
    const db = this.prisma.client;
    const row = await db.dailyReport.findUnique({
      where: { id },
      select: { ...LIST_SELECT, payload: true },
    });
    if (!row) throw new NotFoundException('Report not found');
    const snapshot = row.payload as unknown as DailyReportSnapshot;
    const gen = new Date(snapshot.generatedAt);
    // Only changes AFTER generation: an order already returned when the
    // report was made is part of it, not a change to it.
    const [o, w, previous] = await Promise.all([
      db.order.aggregate({
        where: {
          id: { in: snapshot.orderIds },
          OR: [
            { canceledAt: { gt: gen } },
            { returnedAt: { gt: gen } },
            { deletedAt: { gt: gen } },
          ],
        },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      db.wholesaleOrder.aggregate({
        where: {
          id: { in: snapshot.wholesaleOrderIds },
          cancelledAt: { gt: gen },
        },
        _count: { _all: true },
        _sum: { total: true },
      }),
      row.kind === 'AUTO'
        ? db.dailyReport.findFirst({
            where: {
              kind: 'AUTO',
              periodFrom: new Date(row.periodFrom.getTime() - DAY_MS),
            },
            select: { id: true, totalSales: true, netProfit: true },
          })
        : null,
    ]);
    return {
      ...toListItem(row),
      snapshot,
      changed: {
        orders: o._count._all + w._count._all,
        amount: Number(o._sum.totalAmount ?? 0) + Number(w._sum.total ?? 0),
      },
      previous: previous
        ? {
            id: previous.id,
            totalSales: Number(previous.totalSales),
            netProfit: Number(previous.netProfit),
          }
        : null,
    };
  }

  async snapshotFor(id: number): Promise<{
    name: string;
    kind: DailyReportKind;
    snapshot: DailyReportSnapshot;
  }> {
    const row = await this.prisma.client.dailyReport.findUnique({
      where: { id },
      select: { name: true, kind: true, payload: true },
    });
    if (!row) throw new NotFoundException('Report not found');
    return {
      name: row.name,
      kind: row.kind,
      snapshot: row.payload as unknown as DailyReportSnapshot,
    };
  }

  async remove(id: number): Promise<{ id: number }> {
    const { count } = await this.prisma.client.dailyReport.deleteMany({
      where: { id },
    });
    if (!count) throw new NotFoundException('Report not found');
    return { id };
  }
}
