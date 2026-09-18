import {
  SHIPPED_STATUSES,
  STATUSES,
  type FlagKey,
  type OrderCalc,
  type ReportSettings,
  type ReportStatus,
} from './types';

// Port of the demo's flagsOf and summarize. The summary's money keys are
// renamed (deliveryPaid, courierCost, packaging) so stripMoney can drop them
// without touching o.courier, which is a courier NAME agents may see.

export function diffDays(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000,
  );
}

export function flagsOf(
  c: OrderCalc,
  S: ReportSettings,
  today: string,
): FlagKey[] {
  const f: FlagKey[] = [];
  const o = c.o;
  if (o.status === 'Delivered') {
    // Contribution is also null when the courier charge is unknown (no courier,
    // no bill) — that order is flagged nocourier below, not nocost.
    if (c.contribution == null) {
      if (c.cogs == null) f.push('nocost');
    } else if (c.contribution < 0) f.push('loss');
    else if (c.contribution < S.th.low) f.push('low');
  }
  if (c.overcharge != null && c.overcharge > S.th.over) f.push('over');
  if (SHIPPED_STATUSES.includes(o.status) && !o.courier) f.push('nocourier');
  if (
    (o.status === 'Pending' || o.status === 'Confirmed') &&
    diffDays(o.date, today) > S.th.pending
  )
    f.push('stuck');
  if (
    o.status === 'Delivered' &&
    o.actual == null &&
    o.hist.delivered &&
    diffDays(o.hist.delivered, today) > S.th.bill
  ) {
    f.push('nobill');
  }
  if (c.unconfirmed && (o.status === 'Delivered' || o.status === 'Returned'))
    f.push('unconf');
  return f;
}

export interface Summary {
  n: number;
  st: Record<ReportStatus, number>;
  net: number;
  deliveryPaid: number;
  courierCost: number;
  cogs: number;
  packaging: number;
  fee: number;
  retLoss: number;
  contrib: number;
  subsidy: number;
  overPos: number;
  overN: number;
  dN: number;
  rN: number;
  cN: number;
  newN: number;
  repN: number;
  missing: number;
  est: number;
  grossSales: number;
  margin: number;
  aov: number;
  lossRate: number;
}

export function summarize(list: OrderCalc[], S: ReportSettings): Summary {
  const st = Object.fromEntries(STATUSES.map((x) => [x, 0])) as Record<
    ReportStatus,
    number
  >;
  const s: Summary = {
    n: list.length,
    st,
    net: 0,
    deliveryPaid: 0,
    courierCost: 0,
    cogs: 0,
    packaging: 0,
    fee: 0,
    retLoss: 0,
    contrib: 0,
    subsidy: 0,
    overPos: 0,
    overN: 0,
    dN: 0,
    rN: 0,
    cN: 0,
    newN: 0,
    repN: 0,
    missing: 0,
    est: 0,
    grossSales: 0,
    margin: 0,
    aov: 0,
    lossRate: 0,
  };
  for (const c of list) {
    const o = c.o;
    s.st[o.status]++;
    if (o.ctype === 'New') s.newN++;
    else s.repN++;
    if (c.overcharge != null && c.overcharge > 0) s.overPos += c.overcharge;
    if (c.overcharge != null && c.overcharge > S.th.over) s.overN++;
    if (o.status === 'Delivered') {
      s.grossSales += c.netSales;
      if (c.contribution == null) {
        s.missing++;
        continue;
      }
      s.dN++;
      s.net += c.netSales;
      s.deliveryPaid += o.delivery;
      s.courierCost += c.courierCharge ?? 0;
      s.cogs += c.cogs ?? 0;
      s.packaging += c.packaging;
      s.fee += c.fee;
      s.contrib += c.contribution;
      s.subsidy += c.subsidy ?? 0;
      if (c.estimated) s.est++;
    } else if (o.status === 'Returned') {
      s.rN++;
      if (c.contribution != null) {
        s.retLoss += -c.contribution;
        s.contrib += c.contribution;
      }
    } else if (o.status === 'Cancelled') {
      s.cN++;
    }
  }
  s.margin = s.net ? s.contrib / s.net : 0;
  s.aov = s.dN ? s.net / s.dN : 0;
  const closed = s.dN + s.missing + s.rN + s.cN;
  s.lossRate = closed ? (s.rN + s.cN) / closed : 0;
  return s;
}
