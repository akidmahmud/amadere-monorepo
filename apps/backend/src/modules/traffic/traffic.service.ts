import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';

/** How recently a session must have been seen to count as "on the site now". */
const LIVE_WINDOW_MINUTES = 5;

/**
 * How long raw views are kept.
 *
 * These rows exist to answer "what is happening today"; nobody reads an
 * individual view from March. Pruning keeps the table small enough that the
 * dashboard queries stay index scans, and keeps us holding less data about
 * visitors than we otherwise would.
 */
const RETENTION_DAYS = 90;

/**
 * Bots identify themselves in the UA.
 *
 * Not exhaustive and not meant to be: it catches the crawlers that would
 * otherwise dominate a small site's numbers. Anything pretending to be a
 * browser gets counted as one, which is the right way round to be wrong.
 */
const BOT_UA =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|preview|monitor|curl|wget|python-requests|headless|lighthouse|pingdom|gtmetrix|semrush|ahrefs|screaming frog/i;

function deviceFromUserAgent(ua: string): 'mobile' | 'tablet' | 'desktop' {
  if (/ipad|tablet|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobi|android|iphone|ipod|phone/i.test(ua)) return 'mobile';
  return 'desktop';
}

/**
 * Host only.
 *
 * A full referrer URL can carry a search query or a session token, and "which
 * site sent them" is the whole question anyway.
 */
function referrerDomain(referrer: string | undefined): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

export interface RecordViewInput {
  visitorId: string;
  sessionId: string;
  path: string;
  referrer?: string;
  utmSource?: string;
  userAgent?: string;
  country?: string;
  /** Host of the page that sent the beacon, so self-referrals are dropped. */
  selfHost?: string;
}

export interface TrafficStats {
  /** Distinct sessions seen in the last few minutes. */
  liveVisitors: number;
  viewsToday: number;
  visitorsToday: number;
  /** The whole of yesterday, so today's number has something to mean. */
  visitorsYesterday: number;
  topPages: { path: string; views: number }[];
  topSources: { source: string; views: number }[];
  devices: { device: string; views: number }[];
  liveWindowMinutes: number;
}

/**
 * Midnight in Dhaka as a UTC instant.
 *
 * Same reasoning as dashboard.service.ts: setHours(0,0,0,0) is midnight in the
 * SERVER's timezone, which on a UTC host is 6am local and silently drops the
 * early-morning hours from "today".
 */
function startOfDhakaToday(): Date {
  const nowInDhaka = new Date(Date.now() + 6 * 60 * 60 * 1000);
  const y = nowInDhaka.getUTCFullYear();
  const m = String(nowInDhaka.getUTCMonth() + 1).padStart(2, '0');
  const d = String(nowInDhaka.getUTCDate()).padStart(2, '0');
  return new Date(`${y}-${m}-${d}T00:00:00+06:00`);
}

@Injectable()
export class TrafficService {
  private readonly logger = new Logger(TrafficService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record one page view.
   *
   * Never throws at the caller: an analytics write must not be able to break a
   * page load, so a failure here is logged and swallowed.
   */
  async record(input: RecordViewInput): Promise<void> {
    const ua = input.userAgent ?? '';
    if (BOT_UA.test(ua)) return;

    const domain = referrerDomain(input.referrer);
    try {
      await this.prisma.client.pageView.create({
        data: {
          visitorId: input.visitorId.slice(0, 64),
          sessionId: input.sessionId.slice(0, 64),
          // Query strings are dropped: they hold search terms and coupon
          // codes, and would shatter "top pages" into a thousand near
          // duplicates of the same page.
          path: input.path.split('?')[0].slice(0, 512) || '/',
          // A visitor moving between our own pages is not a referral.
          referrerDomain: domain && domain !== input.selfHost ? domain : null,
          utmSource: input.utmSource?.slice(0, 100) || null,
          country: input.country?.slice(0, 2).toUpperCase() || null,
          device: ua ? deviceFromUserAgent(ua) : null,
        },
      });
    } catch (error) {
      this.logger.warn(`Could not record a page view: ${String(error)}`);
    }
  }

  /** Everything the Overview's traffic panel shows, in one round trip. */
  async stats(): Promise<TrafficStats> {
    const liveSince = new Date(Date.now() - LIVE_WINDOW_MINUTES * 60_000);
    const startToday = startOfDhakaToday();
    const startYesterday = new Date(startToday.getTime() - 86_400_000);

    const [live, viewsToday, visitorsToday, visitorsYesterday, topPages, sourceRows, deviceRows] =
      await Promise.all([
        this.prisma.client.pageView.findMany({
          where: { createdAt: { gte: liveSince } },
          distinct: ['sessionId'],
          select: { sessionId: true },
        }),
        this.prisma.client.pageView.count({ where: { createdAt: { gte: startToday } } }),
        this.prisma.client.pageView.findMany({
          where: { createdAt: { gte: startToday } },
          distinct: ['visitorId'],
          select: { visitorId: true },
        }),
        this.prisma.client.pageView.findMany({
          where: { createdAt: { gte: startYesterday, lt: startToday } },
          distinct: ['visitorId'],
          select: { visitorId: true },
        }),
        this.prisma.client.pageView.groupBy({
          by: ['path'],
          where: { createdAt: { gte: startToday } },
          _count: { _all: true },
          orderBy: { _count: { path: 'desc' } },
          take: 5,
        }),
        this.prisma.client.pageView.groupBy({
          by: ['utmSource', 'referrerDomain'],
          where: { createdAt: { gte: startToday } },
          _count: { _all: true },
        }),
        this.prisma.client.pageView.groupBy({
          by: ['device'],
          where: { createdAt: { gte: startToday } },
          _count: { _all: true },
        }),
      ]);

    // utm_source wins over the referrer header: a campaign that tags its links
    // is telling us what it is, and the referrer on those is usually the ad
    // network's redirector rather than anything a human would recognise.
    const sourceTotals = new Map<string, number>();
    for (const row of sourceRows) {
      const label = row.utmSource || row.referrerDomain || 'Direct';
      sourceTotals.set(label, (sourceTotals.get(label) ?? 0) + row._count._all);
    }

    return {
      liveVisitors: live.length,
      viewsToday,
      visitorsToday: visitorsToday.length,
      visitorsYesterday: visitorsYesterday.length,
      topPages: topPages.map((p) => ({ path: p.path, views: p._count._all })),
      topSources: [...sourceTotals.entries()]
        .map(([source, views]) => ({ source, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 5),
      devices: deviceRows
        .map((d) => ({ device: d.device ?? 'unknown', views: d._count._all }))
        .sort((a, b) => b.views - a.views),
      liveWindowMinutes: LIVE_WINDOW_MINUTES,
    };
  }

  /** Drops views past the retention window. 3am, like the other nightly jobs. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async prune(): Promise<void> {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
    const { count } = await this.prisma.client.pageView.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    if (count > 0) {
      this.logger.log(`Pruned ${count} page views older than ${RETENTION_DAYS} days`);
    }
  }
}
