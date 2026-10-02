import type {
  DailyReportFixedCost,
  DailyReportSettings,
  DailyReportSourceSetting,
  FixedCostType,
} from '@amader/shared';
import { BASE_SOURCES, type SourceDef } from './sources';

export const DEFAULT_SETTINGS: DailyReportSettings = {
  autoEnabled: true,
  sources: [],
  fixedCosts: [],
};

/** Every wholesale channel and store, active or not — a deactivated one's old
 *  orders must still land in their own source, not vanish. Each store is its
 *  own "Shop – <name>" source, right after the generic shop. */
export function allSourceDefs(
  channels: { id: number; name: string }[],
  stores: { id: number; name: string }[] = [],
): SourceDef[] {
  return [
    ...BASE_SOURCES.flatMap((s) =>
      s.key === 'OTHER'
        ? []
        : s.key === 'SHOP'
          ? [
              s,
              ...stores.map((t) => ({
                key: `SHOP_${t.id}`,
                label: `Shop – ${t.name}`,
              })),
            ]
          : [s],
    ),
    ...channels.map((c) => ({ key: `WCH_${c.id}`, label: c.name })),
    ...BASE_SOURCES.filter((s) => s.key === 'OTHER'),
  ];
}

export function resolveSources(
  stored: DailyReportSourceSetting[],
  defs: SourceDef[],
): (DailyReportSourceSetting & { label: string })[] {
  const label = new Map(defs.map((d) => [d.key, d.label]));
  const seen = new Set<string>();
  const out: (DailyReportSourceSetting & { label: string })[] = [];
  for (const s of stored) {
    const l = label.get(s.key);
    if (l === undefined || seen.has(s.key)) continue;
    seen.add(s.key);
    out.push({ key: s.key, enabled: s.enabled, label: l });
  }
  for (const d of defs)
    if (!seen.has(d.key))
      out.push({ key: d.key, enabled: true, label: d.label });
  return out;
}

const TYPES: FixedCostType[] = [
  'PER_DAY',
  'PER_MONTH',
  'PERCENT_OF_SALES',
  'MARKETING_LEDGER',
];

function fail(msg: string): never {
  throw new Error(msg);
}
const rec = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;

export function validateSettings(input: unknown): DailyReportSettings {
  const o = rec(input) ?? fail('Settings must be an object.');
  if (typeof o.autoEnabled !== 'boolean')
    fail('autoEnabled must be true or false.');
  if (!Array.isArray(o.sources)) fail('sources must be a list.');
  if (!Array.isArray(o.fixedCosts)) fail('fixedCosts must be a list.');

  const sources = o.sources.map((raw, i) => {
    const s = rec(raw);
    if (!s || typeof s.key !== 'string' || typeof s.enabled !== 'boolean')
      fail(`Source #${i + 1} is invalid.`);
    return { key: s.key, enabled: s.enabled };
  });

  const ids = new Set<string>();
  const fixedCosts = o.fixedCosts.map((raw, i): DailyReportFixedCost => {
    const label = `Fixed cost #${i + 1}`;
    const c = rec(raw) ?? fail(`${label} is invalid.`);
    if (typeof c.id !== 'string' || !c.id) fail(`${label} is invalid.`);
    if (ids.has(c.id)) fail(`${label} has a duplicate id.`);
    ids.add(c.id);
    const name = typeof c.name === 'string' ? c.name.trim() : '';
    if (!name) fail(`${label} needs a name.`);
    if (name.length > 60)
      fail(`${label} name is too long (60 characters max).`);
    if (!TYPES.includes(c.type as FixedCostType))
      fail(`${label} has an unknown type.`);
    const type = c.type as FixedCostType;
    if (
      typeof c.amount !== 'number' ||
      !Number.isFinite(c.amount) ||
      c.amount < 0
    )
      fail(`${label} amount must be 0 or more.`);
    if (type === 'PERCENT_OF_SALES' && c.amount > 100)
      fail(`${label} percent must be 100 or less.`);
    if (c.scope !== 'REPORT' && c.scope !== 'SOURCE')
      fail(`${label} has an unknown scope.`);
    if (
      c.scope === 'SOURCE' &&
      (typeof c.sourceKey !== 'string' || !c.sourceKey)
    )
      fail(`${label} must name its source.`);
    if (typeof c.active !== 'boolean')
      fail(`${label} active must be true or false.`);
    return {
      id: c.id,
      name,
      type,
      amount: c.amount,
      scope: c.scope,
      ...(c.scope === 'SOURCE' ? { sourceKey: c.sourceKey as string } : {}),
      active: c.active,
    };
  });

  return { autoEnabled: o.autoEnabled, sources, fixedCosts };
}
