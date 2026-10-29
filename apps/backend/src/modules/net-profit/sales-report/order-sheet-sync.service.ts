import { readFileSync } from 'node:fs';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { JWT } from 'google-auth-library';
import { buildSalesSheet, type SalesSheetCell } from '@amader/shared';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { dhakaDate } from '../../product-cost-history/dhaka-date';
import { SalesReportV2Service } from './sales-report-v2.service';
import { ReportSettingsService } from './report-settings.service';
import type { ReportV2QueryDto } from './dto/report-v2-query.dto';

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// The Excel export's colours (admin sheetStyle.ts), as Sheets RGB 0–1.
const rgb = (hex: string) => ({
  red: parseInt(hex.slice(0, 2), 16) / 255,
  green: parseInt(hex.slice(2, 4), 16) / 255,
  blue: parseInt(hex.slice(4, 6), 16) / 255,
});
const COLOR = {
  head: rgb('1F5C3F'),
  white: rgb('FFFFFF'),
  band: rgb('DEEBF7'),
  bandText: rgb('4472C4'),
  group: rgb('64766B'),
  day: rgb('C6EFCE'), // the green row that starts each day
  dayText: rgb('1F5C3F'),
};
/** The courier block the export shades light blue (full view, 0-based, inclusive). */
const BAND: [number, number] = [18, 24];

/** "2026-10" → "Oct 2026", the month's tab. */
export const monthTab = (ym: string) =>
  `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

/** "2026-10-21" → "21 Oct, 2026", the day row's label. */
const dayLabel = (d: string) =>
  `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}, ${d.slice(0, 4)}`;

/**
 * One month tab's rows: the export's two header rows, then each day's orders
 * (oldest first, so new orders land at the bottom) under a row naming the day.
 * Returns the indexes of the day rows for colouring.
 */
export function monthSheet(
  rows: Parameters<typeof buildSalesSheet>[0],
  codPct: Record<string, number>,
): { values: SalesSheetCell[][]; dayRows: number[] } {
  const [groups, head] = buildSalesSheet([], codPct, true);
  const values: SalesSheetCell[][] = [groups, head];
  const dayRows: number[] = [];
  const days = [...new Set(rows.map((r) => r.o.date))].sort();
  for (const d of days) {
    dayRows.push(values.length);
    values.push([dayLabel(d), ...Array<string>(head.length - 1).fill('')]);
    values.push(...buildSalesSheet(rows.filter((r) => r.o.date === d), codPct, true).slice(2));
  }
  return { values, dayRows };
}

/**
 * Live Google Sheet of the Sales Report "Orders" export, for the procurement
 * team: one tab per month, every order except POS shop sales, each day
 * starting with a green date row. Every minute, the month tabs of orders
 * changed since the last run are rebuilt from the same report engine and
 * layout the Export Excel button uses, so the sheet always matches it.
 * Nightly, the current and previous month are rebuilt anyway (courier bills
 * and cost changes don't touch the order itself).
 *
 * Off unless ORDER_SHEET_ID and GOOGLE_SERVICE_ACCOUNT_KEY_FILE are set; the
 * sheet must be shared with the service account's email as Editor.
 */
@Injectable()
export class OrderSheetSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(OrderSheetSyncService.name);
  private readonly sheetId?: string;
  private readonly client?: JWT;
  private lastRun: Date | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly report: SalesReportV2Service,
    private readonly settings: ReportSettingsService,
    config: ConfigService,
  ) {
    this.sheetId = config.get<string>('ORDER_SHEET_ID');
    const keyFile = config.get<string>('GOOGLE_SERVICE_ACCOUNT_KEY_FILE');
    if (!this.sheetId || !keyFile) return;
    try {
      const key = JSON.parse(readFileSync(keyFile, 'utf8')) as {
        client_email: string;
        private_key: string;
      };
      this.client = new JWT({
        email: key.client_email,
        key: key.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
    } catch (e) {
      this.logger.error(`Order sheet off — can't read the key file: ${(e as Error).message}`);
    }
  }

  onApplicationBootstrap() {
    if (!this.client) return;
    this.logger.log('Order sheet sync on');
    // Off the start-up path. First run: this month and last.
    setTimeout(() => void this.tick(), 15_000);
  }

  @Cron('0 * * * * *')
  async tick(): Promise<void> {
    if (!this.client || this.running) return;
    this.running = true;
    const startedAt = new Date();
    try {
      const months = this.lastRun
        ? await this.changedMonths(this.lastRun)
        : this.recentMonths();
      for (const ym of months) await this.rebuildMonth(ym);
      this.lastRun = startedAt;
    } catch (e) {
      // lastRun stays put, so the next minute retries the same changes.
      this.logger.error(`Order sheet sync failed — ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  @Cron('0 30 3 * * *')
  async nightly(): Promise<void> {
    if (!this.client) return;
    for (const ym of this.recentMonths()) await this.rebuildMonth(ym);
  }

  private recentMonths(): string[] {
    const now = dhakaDate(new Date());
    const y = Number(now.slice(0, 4));
    const m = Number(now.slice(5, 7));
    const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
    return [prev, now.slice(0, 7)];
  }

  /** Months (order date, Dhaka) of orders created or changed since `since`. */
  private async changedMonths(since: Date): Promise<string[]> {
    const [orders, wholesale] = await Promise.all([
      this.prisma.client.order.findMany({
        where: { updatedAt: { gt: since }, channel: { not: 'POS' } },
        select: { createdAt: true },
      }),
      this.prisma.client.wholesaleOrder.findMany({
        where: { updatedAt: { gt: since } },
        select: { placedAt: true },
      }),
    ]);
    return [
      ...new Set([
        ...orders.map((o) => dhakaDate(o.createdAt).slice(0, 7)),
        ...wholesale.map((w) => w.placedAt.toISOString().slice(0, 7)),
      ]),
    ].sort();
  }

  /** Rewrites one month's tab from scratch. */
  async rebuildMonth(ym: string): Promise<void> {
    if (!this.client || !this.sheetId) return;
    const last = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0));
    const q = {
      basis: 'order',
      from: `${ym}-01`,
      to: last.toISOString().slice(0, 10),
      all: 'true',
    } as ReportV2QueryDto;
    const [{ rows }, S] = await Promise.all([
      this.report.orders(q, {}),
      this.settings.get(),
    ]);
    const kept = rows
      // POS shop sales stay out. Wholesale rows (negative ids) are counter
      // sales too, and stay in.
      .filter((r) => !(r.o.counter && r.o.id > 0))
      // Oldest first: website orders by id, then wholesale.
      .sort((a, b) => (a.o.id < 0 ? 1e12 - a.o.id : a.o.id) - (b.o.id < 0 ? 1e12 - b.o.id : b.o.id));
    const codPct = Object.fromEntries(
      Object.entries(S.rates ?? {}).map(([k, r]) => [k, r.cod]),
    );
    const { values, dayRows } = monthSheet(kept, codPct);
    await this.writeTab(monthTab(ym), values, dayRows);
    this.logger.log(`Order sheet: ${monthTab(ym)} — ${kept.length} order(s)`);
  }

  private async api<T>(path: string, method: string, data?: unknown): Promise<T> {
    const res = await this.client!.request<T>({
      url: `${SHEETS}/${this.sheetId}${path}`,
      method: method as 'GET',
      data,
    });
    return res.data;
  }

  private async writeTab(title: string, values: SalesSheetCell[][], dayRows: number[]) {
    const meta = await this.api<{ sheets: { properties: { sheetId: number; title: string } }[] }>(
      '?fields=sheets.properties(sheetId,title)',
      'GET',
    );
    let tabId = meta.sheets.find((s) => s.properties.title === title)?.properties.sheetId;
    if (tabId === undefined) {
      const added = await this.api<{ replies: { addSheet: { properties: { sheetId: number } } }[] }>(
        ':batchUpdate',
        'POST',
        { requests: [{ addSheet: { properties: { title, gridProperties: { frozenRowCount: 2 } } } }] },
      );
      tabId = added.replies[0].addSheet.properties.sheetId;
    }
    const width = values[1].length;
    const range = `'${title}'`;
    await this.api(`/values/${encodeURIComponent(range)}:clear`, 'POST', {});
    await this.api(`/values/${encodeURIComponent(`${range}!A1`)}?valueInputOption=RAW`, 'PUT', {
      values,
    });
    const area = (r0: number, r1: number, c0 = 0, c1 = width) => ({
      sheetId: tabId,
      startRowIndex: r0,
      endRowIndex: r1,
      startColumnIndex: c0,
      endColumnIndex: c1,
    });
    const paint = (
      r: ReturnType<typeof area>,
      fmt: Record<string, unknown>,
    ) => ({
      repeatCell: {
        range: r,
        cell: { userEnteredFormat: fmt },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    });
    const n = values.length;
    await this.api(':batchUpdate', 'POST', {
      requests: [
        // Old formatting off first: rows move as orders are added.
        { updateCells: { range: { sheetId: tabId }, fields: 'userEnteredFormat' } },
        { updateSheetProperties: { properties: { sheetId: tabId, gridProperties: { frozenRowCount: 2 } }, fields: 'gridProperties.frozenRowCount' } },
        paint(area(0, 1), { textFormat: { italic: true, foregroundColor: COLOR.group } }),
        paint(area(1, 2), { backgroundColor: COLOR.head, textFormat: { bold: true, foregroundColor: COLOR.white } }),
        paint(area(1, 2, BAND[0], BAND[1] + 1), { backgroundColor: COLOR.band, textFormat: { bold: true, foregroundColor: COLOR.bandText } }),
        ...(n > 2 ? [paint(area(2, n, BAND[0], BAND[1] + 1), { backgroundColor: COLOR.band, textFormat: { foregroundColor: COLOR.bandText } })] : []),
        ...dayRows.map((r) => paint(area(r, r + 1), { backgroundColor: COLOR.day, textFormat: { bold: true, foregroundColor: COLOR.dayText } })),
      ],
    });
  }
}
