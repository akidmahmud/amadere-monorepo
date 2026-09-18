import { Injectable } from '@nestjs/common';
import { calcOrder } from './engine/calc';
import { flagsOf, summarize } from './engine/summary';
import {
  agentRows,
  basisDate,
  channelRows,
  courierRows,
  dailySeries,
  districtRows,
  exceptionGroups,
  productRows,
  topOvercharges,
} from './engine/rows';
import type { FlagKey, OrderCalc, ReportSettings } from './engine/types';
import { ReportLoaderService } from './report-loader.service';
import { ReportSettingsService } from './report-settings.service';
import { stripMoney } from './money';
import { dhakaDate } from '../../product-cost-history/dhaka-date';
import type { ReportV2QueryDto } from './dto/report-v2-query.dto';

export interface Scope {
  /** Set for a view_own-only user: their orders only, money stripped. */
  agentId?: number;
}

const PAGE_SIZE = 50;
const AGENT_FLAGS: FlagKey[] = ['stuck', 'nocourier'];

@Injectable()
export class SalesReportV2Service {
  constructor(
    private readonly loader: ReportLoaderService,
    private readonly settings: ReportSettingsService,
  ) {}

  private range(q: ReportV2QueryDto) {
    const today = dhakaDate(new Date());
    return { from: q.from ?? today, to: q.to ?? today };
  }

  private async calcs(
    q: ReportV2QueryDto,
    scope: Scope,
    ignoreDate = false,
  ): Promise<{ set: OrderCalc[]; S: ReportSettings }> {
    const { from, to } = this.range(q);
    const [orders, S] = await Promise.all([
      this.loader.load({
        from,
        to,
        basis: q.basis,
        ignoreDate,
        agentId: scope.agentId,
      }),
      this.settings.get(),
    ]);
    const set = orders
      .map((o) => calcOrder(o, S))
      .filter(({ o }) => {
        if (!ignoreDate) {
          const d = basisDate(o, q.basis);
          if (!d || d < from || d > to) return false;
        }
        if (q.channel && o.channel !== q.channel) return false;
        if (q.agent && String(o.agentId ?? 'none') !== q.agent) return false;
        if (q.courier && (o.courier ?? 'none') !== q.courier) return false;
        if (q.district && o.district !== q.district) return false;
        if (q.status && o.status !== q.status) return false;
        return true;
      });
    return { set, S };
  }

  private out<T>(v: T, scope: Scope): T {
    return scope.agentId !== undefined ? stripMoney(v) : v;
  }

  private withFlags(list: OrderCalc[], S: ReportSettings, scope: Scope) {
    const today = dhakaDate(new Date());
    return list.map((c) => ({
      ...c,
      flags: flagsOf(c, S, today).filter(
        (f) => scope.agentId === undefined || AGENT_FLAGS.includes(f),
      ),
    }));
  }

  async overview(q: ReportV2QueryDto, scope: Scope) {
    const { set, S } = await this.calcs(q, scope);
    const { from, to } = this.range(q);
    const agents = new Map<number | null, string>();
    for (const c of set)
      agents.set(c.o.agentId, c.o.agentName ?? 'Website (no agent)');
    return this.out(
      {
        summary: summarize(set, S),
        channels: channelRows(set, S),
        daily: dailySeries(set, S, from, to, q.basis),
        options: {
          channels: [...new Set(set.map((c) => c.o.channel))].sort(),
          agents: [...agents.entries()]
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name)),
          couriers: [
            ...new Set(
              set.map((c) => c.o.courier).filter((x): x is string => !!x),
            ),
          ].sort(),
          districts: [
            ...new Set(set.map((c) => c.o.district).filter(Boolean)),
          ].sort(),
        },
      },
      scope,
    );
  }

  async orders(q: ReportV2QueryDto, scope: Scope) {
    const { set, S } = await this.calcs(q, scope);
    const needle = q.q?.trim().toLowerCase();
    const list = needle
      ? set.filter((c) =>
          [c.o.orderNumber, c.o.customer, c.o.phone]
            .join(' ')
            .toLowerCase()
            .includes(needle),
        )
      : set;
    const sorters: Record<string, (a: OrderCalc, b: OrderCalc) => number> = {
      newest: (a, b) =>
        (b.o.date + b.o.orderNumber).localeCompare(a.o.date + a.o.orderNumber),
      contrib: (a, b) => (a.contribution ?? 1e9) - (b.contribution ?? 1e9),
      sales: (a, b) => b.netSales - a.netSales,
      over: (a, b) => (b.overcharge ?? -1e9) - (a.overcharge ?? -1e9),
    };
    // Agents can't sort by money they can't see.
    const sort =
      scope.agentId !== undefined && (q.sort === 'contrib' || q.sort === 'over')
        ? 'newest'
        : (q.sort ?? 'newest');
    list.sort(sorters[sort]);
    // `all` is the export: the whole filtered set, not the page on screen.
    const page = q.all ? 1 : (q.page ?? 1);
    const pageSize = q.all ? list.length : PAGE_SIZE;
    const rows = this.withFlags(
      list.slice((page - 1) * pageSize, page * pageSize),
      S,
      scope,
    );
    return this.out({ total: list.length, page, pageSize, rows }, scope);
  }

  async agents(q: ReportV2QueryDto) {
    const { set, S } = await this.calcs(q, {});
    return { rows: agentRows(set, S) };
  }

  async products(q: ReportV2QueryDto) {
    const { set } = await this.calcs(q, {});
    return { rows: productRows(set) };
  }

  async couriers(q: ReportV2QueryDto) {
    const { set, S } = await this.calcs(q, {});
    return {
      rows: courierRows(set, S),
      top: this.withFlags(topOvercharges(set, S), S, {}),
    };
  }

  async districts(q: ReportV2QueryDto) {
    const { set, S } = await this.calcs(q, {});
    return { rows: districtRows(set, S) };
  }

  /** Date range ignored so nothing old is missed; other filters still apply. */
  async exceptions(q: ReportV2QueryDto, scope: Scope) {
    const { set, S } = await this.calcs(q, scope, true);
    const today = dhakaDate(new Date());
    const groups = exceptionGroups(
      set,
      S,
      today,
      scope.agentId !== undefined ? AGENT_FLAGS : undefined,
    );
    const flagged = new Set(groups.flatMap((g) => g.list));
    return this.out(
      {
        total: flagged.size,
        groups: groups.map((g) => ({
          flag: g.flag,
          rows: this.withFlags(g.list, S, scope),
        })),
      },
      scope,
    );
  }
}
