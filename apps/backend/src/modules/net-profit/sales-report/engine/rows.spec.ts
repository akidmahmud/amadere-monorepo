import { calcOrder } from './calc';
import { DEMO_EXCEL_DAY, DEMO_TODAY, demoSettings } from './demo.fixture';
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
} from './rows';

const S = demoSettings();
const set = DEMO_EXCEL_DAY.map((o) => calcOrder(o, S));

it('basisDate uses the order date or the delivered/returned date', () => {
  const ret = DEMO_EXCEL_DAY[18];
  expect(basisDate(ret, 'order')).toBe('2026-08-01');
  expect(basisDate(ret, 'delivered')).toBe('2026-08-04');
  expect(basisDate(DEMO_EXCEL_DAY[0], 'delivered')).toBeNull();
});

it('channelRows: orders, delivered, net sales, contribution per channel', () => {
  const by = Object.fromEntries(
    channelRows(set, S).map((r) => [
      r.channel,
      [r.s.n, r.s.dN, r.s.net, r.s.contrib],
    ]),
  );
  expect(by).toEqual({
    Call: [5, 5, 5000, 1825],
    Facebook: [4, 2, 950, 245],
    WhatsApp: [6, 5, 2785, 715],
    Website: [4, 3, 2230, 653],
  });
});

it('agentRows ranks on both measures; the website bucket has no agent', () => {
  const rows = agentRows(set, S);
  const jami = rows.find((r) => r.agentName === 'Jami')!;
  expect([jami.s.n, jami.s.dN, jami.s.net, jami.s.contrib]).toEqual([
    6, 3, 3165, 1185,
  ]);
  const web = rows.find((r) => r.agentId === null)!;
  expect([web.s.n, web.s.contrib]).toEqual([4, 653]);
  // By contribution: Jami 1185, website 653, Sanowar 605, Arafat 535, Mim 320, Tahrima 140.
  expect(rows[0].agentName).toBe('Jami');
  expect(rows.map((r) => r.rankContrib).sort()).toEqual([1, 2, 3, 4, 5, 6]);
});

it('productRows share subsidy by weight and add back to total contribution', () => {
  const rows = productRows(set);
  const ja1 = rows.find((r) => r.key === 'JA1')!;
  expect(ja1).toMatchObject({
    units: 8,
    net: 2800,
    cogs: 1440,
    subsidy: 375,
    ret: 0,
    contrib: 985,
    costStatus: 'confirmed',
  });
  const mc05 = rows.find((r) => r.key === 'MC05')!;
  expect(mc05).toMatchObject({
    ret: 130,
    contrib: -130,
    costStatus: 'unconfirmed',
  });
  expect(Math.round(rows.reduce((a, r) => a + r.contrib, 0))).toBe(3438);
});

it('courierRows: agreed vs billed per courier, with the no-courier bucket', () => {
  const rows = courierRows(set, S);
  const sf = rows.find((r) => r.courier === 'Steadfast')!;
  expect(sf).toMatchObject({
    n: 14,
    ret: 1,
    agreed: 2107,
    billed: 2395,
    over: 294,
    under: -6,
    overN: 11,
    awaiting: 0,
    collect: 11129,
    recv: 8734,
  });
  const none = rows.find((r) => r.courier === null)!;
  expect(none).toMatchObject({ n: 1, billed: 145, recv: 405 });
});

it('topOvercharges lists the largest first', () => {
  expect(
    topOvercharges(set, S, 3).map((c) => [
      c.o.orderNumber.slice(-6),
      c.overcharge,
    ]),
  ).toEqual([
    ['D56518', 63.7],
    ['D56511', 47.8],
    ['D56505', 36.85],
  ]);
});

it('districtRows summarise by district, largest net first', () => {
  const rows = districtRows(set, S);
  expect(rows[0].district).toBe('Rajshahi');
  const raj = rows[0].s;
  expect([
    raj.n,
    raj.dN,
    raj.net,
    raj.contrib,
    raj.deliveryPaid,
    raj.courierCost,
    raj.subsidy,
  ]).toEqual([12, 11, 7900, 2383, 829, 1925, 1096]);
});

it('dailySeries gives one point per day in range', () => {
  const pts = dailySeries(set, S, '2026-08-01', '2026-08-03', 'delivered');
  expect(pts.map((p) => p.date)).toEqual([
    '2026-08-01',
    '2026-08-02',
    '2026-08-03',
  ]);
  expect(pts[0].net).toBe(0);
});

it('exceptionGroups follow the demo order and can be restricted', () => {
  const groups = exceptionGroups(set, S, DEMO_TODAY);
  expect(groups.map((g) => g.flag)).toEqual([
    'over',
    'stuck',
    'nocourier',
    'low',
    'unconf',
  ]);
  expect(groups.find((g) => g.flag === 'over')!.list).toHaveLength(12);
  const agentOnly = exceptionGroups(set, S, DEMO_TODAY, ['stuck', 'nocourier']);
  expect(agentOnly.map((g) => g.flag)).toEqual(['stuck', 'nocourier']);
});
