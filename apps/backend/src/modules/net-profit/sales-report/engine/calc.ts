import {
  SHIPPED_STATUSES,
  type CalcLine,
  type CourierRate,
  type OrderCalc,
  type ReportOrder,
  type ReportSettings,
} from './types';

// A line-for-line port of the demo's calcOrder (amadere-sales-report-demo.html).
// Keep the formulas identical: the owner has already reconciled them against
// Daily_Sales_Data.xlsx, and the fixture tests pin them to the demo's output.

export const r2 = (n: number) => Math.round(n * 100) / 100;
const sum = (xs: number[]) => xs.reduce((a, x) => a + x, 0);

/** Small-parcel rate up to smallMax, first-kg rate up to 1 kg, then +extra per started kg. */
export function rateFor(
  rc: CourierRate | null,
  zone: string,
  w: number,
): number | null {
  if (!rc) return null;
  const z = rc.zones[zone];
  if (!z) return null;
  if (w <= z.smallMax + 1e-9) return z.small;
  if (w <= 1 + 1e-9) return z.first;
  return z.first + Math.ceil(w - 1 - 1e-9) * z.extra;
}

export function calcOrder(o: ReportOrder, S: ReportSettings): OrderCalc {
  const lines: CalcLine[] = o.lines.map((l) => {
    const gross = l.qty * l.price;
    return {
      ...l,
      gross,
      net: gross - l.disc,
      weight: l.qty * l.unitWeight,
      cogs: l.unitCost == null ? null : l.unitCost * l.qty,
    };
  });
  const netSales = sum(lines.map((l) => l.net));
  const weight = r2(sum(lines.map((l) => l.weight)));
  const rc = o.courier ? (S.rates[o.courier] ?? null) : null;
  const collect = Math.max(0, netSales + o.delivery - o.advance);
  const rate = rateFor(rc, o.zone, weight);
  const isRet = o.status === 'Returned';
  let cod = 0;
  if (rc && !isRet && collect > 0)
    cod = r2(((rc.codBase === 'product' ? netSales : collect) * rc.cod) / 100);
  const expected =
    rate == null || !rc
      ? null
      : isRet
        ? r2((rate * rc.returnPct) / 100)
        : r2(rate + cod);
  const shipped = SHIPPED_STATUSES.includes(o.status);
  const courierCharge = shipped ? (o.actual ?? expected) : 0;
  const estimated = shipped && o.actual == null;
  const overcharge =
    o.actual != null && expected != null ? r2(o.actual - expected) : null;
  const cogs = lines.some((l) => l.cogs == null)
    ? null
    : sum(lines.map((l) => l.cogs as number));
  const packaging = shipped ? S.packaging : 0;
  const fee = r2((o.advance * (S.fees[o.payment] ?? 0)) / 100);

  let contribution: number | null = null;
  let subsidy: number | null = null;
  let receivable: number | null = null;
  if (o.status === 'Delivered' && courierCharge != null) {
    if (cogs != null)
      contribution = r2(
        netSales + o.delivery - courierCharge - cogs - packaging - fee,
      );
    subsidy = r2(courierCharge - o.delivery);
    receivable = r2(collect - courierCharge);
  }
  if (isRet && courierCharge != null) {
    contribution = r2(-courierCharge - packaging - fee);
    receivable = r2(-courierCharge);
  }
  const unconfirmed = lines.some((l) => l.unitCost != null && !l.costOk);

  return {
    o,
    lines,
    netSales,
    weight,
    zone: o.zone,
    collect,
    rate,
    cod,
    expected,
    shipped,
    courierCharge,
    estimated,
    overcharge,
    cogs,
    packaging,
    fee,
    contribution,
    subsidy,
    receivable,
    unconfirmed,
  };
}
