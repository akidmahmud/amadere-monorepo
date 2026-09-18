import { stripMoney, MONEY_KEYS } from './money';
import { SalesReportV2Service } from './sales-report-v2.service';
import { DEMO_EXCEL_DAY, demoSettings } from './engine/demo.fixture';

function svc() {
  const loader = { load: jest.fn().mockResolvedValue(DEMO_EXCEL_DAY) };
  const settings = { get: jest.fn().mockResolvedValue(demoSettings()) };
  return {
    s: new SalesReportV2Service(loader as never, settings as never),
    loader,
  };
}
const q = { basis: 'order' as const, from: '2026-08-01', to: '2026-08-01' };

const keysDeep = (v: unknown, out = new Set<string>()): Set<string> => {
  if (Array.isArray(v)) v.forEach((x) => keysDeep(x, out));
  else if (v && typeof v === 'object')
    for (const [k, x] of Object.entries(v)) {
      out.add(k);
      keysDeep(x, out);
    }
  return out;
};

describe('SalesReportV2Service', () => {
  it('overview reproduces the ৳3,438 day', async () => {
    const r = await svc().s.overview(q, {});
    expect(Math.round(r.summary.contrib)).toBe(3438);
    expect(r.options.channels).toEqual([
      'Call',
      'Facebook',
      'Website',
      'WhatsApp',
    ]);
  });

  it('filters by channel, courier "none" and status', async () => {
    const { s } = svc();
    expect((await s.orders({ ...q, channel: 'Website' }, {})).total).toBe(4);
    expect((await s.orders({ ...q, courier: 'none' }, {})).total).toBe(1);
    expect((await s.orders({ ...q, status: 'Returned' }, {})).total).toBe(1);
  });

  it('all=true returns every filtered order unpaged (the export)', async () => {
    const r = await svc().s.orders({ ...q, all: 'true' }, {});
    expect(r.rows).toHaveLength(19);
    expect(r.pageSize).toBe(19);
  });

  it("an agent scope loads only that agent's orders and returns no money anywhere", async () => {
    const { s, loader } = svc();
    const r = await s.overview(q, { agentId: 1 });
    expect(loader.load).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: 1 }),
    );
    const leaked = [...keysDeep(r)].filter((k) => MONEY_KEYS.has(k));
    expect(leaked).toEqual([]);
  });

  it('agent exceptions are limited to stuck and nocourier', async () => {
    const r = await svc().s.exceptions(q, { agentId: 1 });
    expect(
      r.groups
        .map((g) => g.flag)
        .every((f) => f === 'stuck' || f === 'nocourier'),
    ).toBe(true);
  });
});

describe('stripMoney', () => {
  it('removes money keys at any depth and keeps the rest', () => {
    expect(
      stripMoney({
        o: { courier: 'STEADFAST', delivery: 100 },
        lines: [{ name: 'x', unitCost: 5 }],
        contribution: 1,
      }),
    ).toEqual({ o: { courier: 'STEADFAST' }, lines: [{ name: 'x' }] });
  });
});
