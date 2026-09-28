import { Prisma } from '@amader/db';
import { PosSmsService, POS_SMS_DEFAULTS } from './pos-sms.service';
import { DEFAULT_TIERS } from './pos-tiers';

const D = (n: number) => new Prisma.Decimal(n);

function make(opts: {
  order?: object | null;
  stats?: { customerId: number; storeId: number; orders: number; spent: number; last: Date }[];
  campaigns?: object[];
  gateway?: boolean;
} = {}) {
  const sms = {
    getSettings: jest.fn().mockResolvedValue({ enabled: opts.gateway ?? true, senderId: 'AMADER', hasApiKey: true }),
    send: jest.fn().mockResolvedValue({}),
    getBalance: jest.fn().mockResolvedValue(120),
  };
  const tiers = {
    getTiers: jest.fn().mockResolvedValue(DEFAULT_TIERS),
    stats: jest.fn().mockResolvedValue(opts.stats ?? []),
  };
  const prisma = {
    client: {
      setting: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
      order: { findUnique: jest.fn().mockResolvedValue(opts.order ?? null), findFirst: jest.fn().mockResolvedValue({ id: 77 }) },
      posSmsCampaign: {
        findMany: jest.fn().mockResolvedValue(opts.campaigns ?? []),
        update: jest.fn(),
        create: jest.fn((a: { data: object }) => Promise.resolve({ id: 1, ...a.data })),
      },
      posSmsDelivery: { create: jest.fn() },
      customer: {
        findMany: jest.fn(({ where }: { where: { id: { in: number[] } } }) =>
          Promise.resolve(where.id.in.map((id) => ({ id, firstName: `C${id}`, lastName: null, phone: `0181000000${id}` }))),
        ),
      },
      store: { findMany: jest.fn().mockResolvedValue([{ id: 4, name: 'Uttara' }]) },
    },
  };
  const svc = new PosSmsService(prisma as never, sms as never, tiers as never);
  return { svc, sms, tiers, prisma };
}

const sale = {
  orderNumber: 'ORD-1', totalAmount: D(360), storeId: 4, customerId: 9,
  store: { name: 'Uttara' },
  customer: { firstName: 'Karim', lastName: null, phone: '01811111111' },
};

describe('PosSmsService — after a sale', () => {
  it('sends the editable thank-you with total, order, store and website', async () => {
    const { svc, sms } = make({ order: sale, stats: [{ customerId: 9, storeId: 4, orders: 1, spent: 360, last: new Date() }] });
    await svc.afterSale(1);
    expect(sms.send).toHaveBeenCalledWith(
      '01811111111',
      'Thank you for shopping at Uttara, Karim! Your total is ৳360.00 (order ORD-1). Shop online: https://amadere.com',
      'pos_thank_you',
    );
    expect(POS_SMS_DEFAULTS.thankYouEnabled).toBe(true);
  });

  it('nothing when the customer has no phone or the gateway is off', async () => {
    const a = make({ order: { ...sale, customer: { firstName: 'X', lastName: null, phone: null } } });
    await a.svc.afterSale(1);
    const b = make({ order: sale, gateway: false });
    await b.svc.afterSale(1);
    expect(a.sms.send).not.toHaveBeenCalled();
    expect(b.sms.send).not.toHaveBeenCalled();
  });

  it('congratulates once when THIS sale moves the customer up a tier at the store', async () => {
    // 5th purchase → Silver (was Regular with 4).
    const campaign = { id: 3, type: 'TIER_UPGRADE', message: 'Congrats {{name}}, you are {{tier}} at {{store}}!', storeId: null, tierKey: null };
    const { svc, sms, prisma } = make({
      order: sale,
      stats: [{ customerId: 9, storeId: 4, orders: 5, spent: 1000, last: new Date() }],
      campaigns: [campaign],
    });
    await svc.afterSale(1);
    expect(prisma.client.posSmsDelivery.create).toHaveBeenCalledWith({
      data: { campaignId: 3, customerId: 9, key: 'up:4:silver' },
    });
    expect(sms.send).toHaveBeenLastCalledWith('01811111111', 'Congrats Karim, you are Silver at Uttara!', 'pos_campaign:3');
  });

  it('no upgrade text when the tier did not change', async () => {
    const { svc, prisma } = make({
      order: sale,
      stats: [{ customerId: 9, storeId: 4, orders: 3, spent: 1000, last: new Date() }],
      campaigns: [{ id: 3, type: 'TIER_UPGRADE', message: 'x', storeId: null, tierKey: null }],
    });
    await svc.afterSale(1);
    expect(prisma.client.posSmsCampaign.findMany).not.toHaveBeenCalled();
  });
});

describe('PosSmsService — campaigns', () => {
  const stats = [
    { customerId: 1, storeId: 4, orders: 1, spent: 100, last: new Date() }, // Regular
    { customerId: 2, storeId: 4, orders: 12, spent: 100, last: new Date() }, // Gold
  ];

  it('audience by tier at the store', async () => {
    const { svc } = make({ stats });
    expect((await svc.audience(4, 'gold')).map((r) => r.customerId)).toEqual([2]);
    expect((await svc.audience(4, null)).length).toBe(2);
  });

  it('"Send now" sends to everyone in the audience with their own name/tier', async () => {
    const { svc, sms } = make({ stats });
    const out = await svc.create({ name: 'Eid', type: 'NOW', message: 'Eid Mubarak {{name}} ({{tier}})', storeId: 4 }, 7);
    expect((out as { sent?: number }).sent).toBe(2);
    expect(sms.send).toHaveBeenCalledWith('01810000002', 'Eid Mubarak C2 (Gold)', 'pos_campaign:1');
  });

  it('refuses to send when the SMS gateway is off', async () => {
    const { svc } = make({ stats, gateway: false });
    await expect(svc.create({ name: 'X', type: 'NOW', message: 'hi' }, 7)).rejects.toThrow(/gateway is off/);
  });

  it('due recurring campaigns move to their next run before sending; scheduled ones finish', async () => {
    const now = new Date('2026-10-10T05:00:00Z');
    const { svc, prisma } = make({
      stats,
      campaigns: [
        { id: 5, type: 'RECURRING', repeat: 'WEEKLY', nextRunAt: new Date('2026-10-10T04:00:00Z'), message: 'hi', storeId: null, tierKey: null },
        { id: 6, type: 'SCHEDULED', nextRunAt: new Date('2026-10-10T04:30:00Z'), message: 'hi', storeId: null, tierKey: null },
      ],
    });
    await svc.runDue(now);
    expect(prisma.client.posSmsCampaign.update).toHaveBeenCalledWith({ where: { id: 5 }, data: { nextRunAt: new Date('2026-10-17T04:00:00Z') } });
    expect(prisma.client.posSmsCampaign.update).toHaveBeenCalledWith({ where: { id: 6 }, data: { active: false, nextRunAt: null } });
  });

  it('validates each kind', async () => {
    const { svc } = make();
    await expect(svc.create({ name: 'a', type: 'SCHEDULED', message: 'm' }, 1)).rejects.toThrow(/date and time/);
    await expect(svc.create({ name: 'a', type: 'RECURRING', message: 'm', sendAt: '2026-10-10T10:00:00Z' }, 1)).rejects.toThrow(/repeats/);
    await expect(svc.create({ name: 'a', type: 'WINBACK', message: 'm' }, 1)).rejects.toThrow(/number of days/);
    await expect(svc.create({ name: '', type: 'WINBACK', message: 'm', winbackDays: 30 }, 1)).rejects.toThrow(/name/);
  });
});
