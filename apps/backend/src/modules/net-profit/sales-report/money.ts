/**
 * Every field that carries a cost, a margin or a courier charge. Agents
 * (`net_profit_reports.view_own` only) must never receive these — stripped
 * server-side, so hiding a column in the UI is not the only barrier.
 * Sales figures (netSales, grossSales, collect, advance) are NOT here: the
 * demo shows them to agents.
 */
export const MONEY_KEYS = new Set([
  'delivery',
  'actual',
  'courierCharge',
  'expected',
  'rate',
  'cod',
  'overcharge',
  'cogs',
  'unitCost',
  'costOk',
  'packaging',
  'fee',
  'contribution',
  'subsidy',
  'receivable',
  'estimated',
  'unconfirmed',
  'net',
  'deliveryPaid',
  'courierCost',
  'retLoss',
  'contrib',
  'overPos',
  'overN',
  'margin',
  'aov',
]);

export function stripMoney<T>(v: T): T {
  if (Array.isArray(v)) return (v as unknown[]).map((x) => stripMoney(x)) as T;
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .filter(([k]) => !MONEY_KEYS.has(k))
        .map(([k, x]) => [k, stripMoney(x)]),
    ) as T;
  }
  return v;
}
