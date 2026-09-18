import { r2 } from './calc';
import { flagsOf, summarize, type Summary } from './summary';
import type { FlagKey, OrderCalc, ReportOrder, ReportSettings } from './types';

// Ports of the demo's per-tab aggregations (viewOverview/viewAgents/
// productRows/viewCouriers/viewDistricts/viewExceptions), minus the HTML.

export type Basis = 'order' | 'delivered';

export function basisDate(o: ReportOrder, basis: Basis): string | null {
  return basis === 'order'
    ? o.date
    : (o.hist.delivered ?? o.hist.returned ?? null);
}

export function addDays(s: string, n: number): string {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const sum = (xs: number[]) => xs.reduce((a, x) => a + x, 0);

export function channelRows(set: OrderCalc[], S: ReportSettings) {
  const channels = [...new Set(set.map((c) => c.o.channel))].sort();
  return channels.map((channel) => ({
    channel,
    s: summarize(
      set.filter((c) => c.o.channel === channel),
      S,
    ),
  }));
}

export interface DayPoint {
  date: string;
  net: number;
  grossSales: number;
  contrib: number;
}

/** One point per day, capped at 92 days so a year-long range cannot render 365 bars. */
export function dailySeries(
  set: OrderCalc[],
  S: ReportSettings,
  from: string,
  to: string,
  basis: Basis,
): DayPoint[] {
  const out: DayPoint[] = [];
  for (let d = from; d <= to && out.length < 92; d = addDays(d, 1)) {
    const s = summarize(
      set.filter((c) => basisDate(c.o, basis) === d),
      S,
    );
    out.push({
      date: d,
      net: s.net,
      grossSales: s.grossSales,
      contrib: s.contrib,
    });
  }
  return out;
}

export interface AgentRow {
  agentId: number | null;
  agentName: string | null;
  s: Summary;
  rankSales: number;
  rankContrib: number;
}

export function agentRows(set: OrderCalc[], S: ReportSettings): AgentRow[] {
  const byId = new Map<number | null, string | null>();
  for (const c of set) byId.set(c.o.agentId, c.o.agentName);
  const rows = [...byId.entries()]
    .map(([agentId, agentName]) => ({
      agentId,
      agentName,
      s: summarize(
        set.filter((c) => c.o.agentId === agentId),
        S,
      ),
    }))
    .filter((r) => r.s.n > 0);
  const bySales = [...rows].sort((a, b) => b.s.net - a.s.net);
  const byContrib = [...rows].sort((a, b) => b.s.contrib - a.s.contrib);
  return byContrib.map((r) => ({
    ...r,
    rankSales: bySales.indexOf(r) + 1,
    rankContrib: byContrib.indexOf(r) + 1,
  }));
}

export interface ProductRow {
  key: string;
  name: string;
  units: number;
  net: number;
  cogs: number;
  subsidy: number;
  other: number;
  ret: number;
  contrib: number;
  costStatus: 'confirmed' | 'unconfirmed' | 'missing';
}

/**
 * Delivery subsidy and return losses are shared across an order's lines by
 * weight; packaging by weight and payment fees by value — so each order's
 * parts add back to its contribution (the demo's rule).
 */
export function productRows(set: OrderCalc[]): ProductRow[] {
  const acc = new Map<string, ProductRow>();
  const get = (key: string, name: string) => {
    let r = acc.get(key);
    if (!r) {
      r = {
        key,
        name,
        units: 0,
        net: 0,
        cogs: 0,
        subsidy: 0,
        other: 0,
        ret: 0,
        contrib: 0,
        costStatus: 'confirmed',
      };
      acc.set(key, r);
    }
    return r;
  };
  const mark = (r: ProductRow, unitCost: number | null, costOk: boolean) => {
    if (unitCost == null) r.costStatus = 'missing';
    else if (!costOk && r.costStatus !== 'missing')
      r.costStatus = 'unconfirmed';
  };
  for (const c of set) {
    const n = c.lines.length || 1;
    if (c.o.status === 'Delivered') {
      if (c.contribution == null) {
        for (const l of c.lines) mark(get(l.key, l.name), l.unitCost, l.costOk);
        continue;
      }
      for (const l of c.lines) {
        const a = get(l.key, l.name);
        mark(a, l.unitCost, l.costOk);
        const ws = c.weight ? l.weight / c.weight : 1 / n;
        const vs = c.netSales ? l.net / c.netSales : 1 / n;
        const sub = (c.subsidy ?? 0) * ws;
        const other = c.packaging * ws + c.fee * vs;
        a.units += l.qty;
        a.net += l.net;
        a.cogs += l.cogs ?? 0;
        a.subsidy += sub;
        a.other += other;
        a.contrib += l.net - (l.cogs ?? 0) - sub - other;
      }
    } else if (c.o.status === 'Returned' && c.contribution != null) {
      for (const l of c.lines) {
        const a = get(l.key, l.name);
        mark(a, l.unitCost, l.costOk);
        const ws = c.weight ? l.weight / c.weight : 1 / n;
        a.ret += -c.contribution * ws;
        a.contrib += c.contribution * ws;
      }
    }
  }
  return [...acc.values()].sort((a, b) => b.contrib - a.contrib);
}

export interface CourierRow {
  courier: string | null;
  n: number;
  ret: number;
  agreed: number;
  billed: number;
  over: number;
  under: number;
  overN: number;
  awaiting: number;
  awaitingAmt: number;
  collect: number;
  recv: number;
}

export function courierRows(set: OrderCalc[], S: ReportSettings): CourierRow[] {
  const closed = set.filter(
    (c) => c.o.status === 'Delivered' || c.o.status === 'Returned',
  );
  const keys = [
    ...new Set(
      closed.map((c) => c.o.courier).filter((k): k is string => k !== null),
    ),
  ].sort();
  return [...keys, null]
    .map((courier) => {
      const l = closed.filter((c) => c.o.courier === courier);
      const billed = l.filter((c) => c.o.actual != null);
      const withBoth = billed.filter((c) => c.expected != null);
      const awaiting = l.filter((c) => c.o.actual == null);
      return {
        courier,
        n: l.length,
        ret: l.filter((c) => c.o.status === 'Returned').length,
        agreed: r2(sum(withBoth.map((c) => c.expected as number))),
        billed: sum(billed.map((c) => c.o.actual as number)),
        over: r2(sum(withBoth.map((c) => Math.max(0, c.overcharge as number)))),
        under: r2(
          sum(withBoth.map((c) => Math.min(0, c.overcharge as number))),
        ),
        overN: withBoth.filter((c) => (c.overcharge as number) > S.th.over)
          .length,
        awaiting: awaiting.length,
        awaitingAmt: sum(awaiting.map((c) => c.expected ?? 0)),
        collect: sum(
          l.filter((c) => c.o.status === 'Delivered').map((c) => c.collect),
        ),
        recv: r2(sum(l.map((c) => c.receivable ?? 0))),
      };
    })
    .filter((r) => r.n > 0);
}

export function topOvercharges(
  set: OrderCalc[],
  S: ReportSettings,
  limit = 8,
): OrderCalc[] {
  return set
    .filter(
      (c) =>
        (c.o.status === 'Delivered' || c.o.status === 'Returned') &&
        c.overcharge != null &&
        c.overcharge > S.th.over,
    )
    .sort((a, b) => (b.overcharge as number) - (a.overcharge as number))
    .slice(0, limit);
}

export interface DistrictRow {
  district: string;
  zone: string;
  s: Summary;
}

export function districtRows(
  set: OrderCalc[],
  S: ReportSettings,
): DistrictRow[] {
  const districts = [...new Set(set.map((c) => c.o.district))];
  return districts
    .map((district) => {
      const l = set.filter((c) => c.o.district === district);
      return { district, zone: l[0].zone, s: summarize(l, S) };
    })
    .sort((a, b) => b.s.net - a.s.net);
}

export const EXCEPTION_ORDER: FlagKey[] = [
  'loss',
  'over',
  'stuck',
  'nocost',
  'nocourier',
  'nobill',
  'low',
  'unconf',
];

export function exceptionGroups(
  set: OrderCalc[],
  S: ReportSettings,
  today: string,
  allowed?: FlagKey[],
) {
  const flags = new Map(set.map((c) => [c, flagsOf(c, S, today)]));
  return EXCEPTION_ORDER.filter((f) => !allowed || allowed.includes(f))
    .map((flag) => ({
      flag,
      list: set.filter((c) => flags.get(c)!.includes(flag)),
    }))
    .filter((g) => g.list.length > 0);
}
