import { DailyReportService } from './daily-report.service';
import { DEFAULT_SETTINGS } from './settings';

function make(
  opts: { existing?: unknown; createError?: Error; purgeError?: Error } = {},
) {
  const create = jest.fn(({ data }: { data: Record<string, unknown> }) =>
    opts.createError
      ? Promise.reject(opts.createError)
      : Promise.resolve({
          id: 5,
          createdAt: new Date('2026-10-01T00:15:00Z'),
          ...data,
        }),
  );
  const prisma = {
    client: {
      dailyReport: {
        deleteMany: opts.purgeError
          ? jest.fn().mockRejectedValue(opts.purgeError)
          : jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue(opts.existing ?? null),
        create,
      },
      wholesaleChannel: { findMany: jest.fn().mockResolvedValue([]) },
      marketingCost: {
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { adsCost: null, otherCost: null } }),
      },
    },
  };
  const loader = { load: jest.fn().mockResolvedValue([]) };
  const settings = {
    getNamespace: jest.fn().mockResolvedValue(DEFAULT_SETTINGS),
    set: jest.fn(),
  };
  const svc = new DailyReportService(
    prisma as never,
    loader as never,
    settings as never,
  );
  return { svc, create, loader };
}

describe('DailyReportService.generateAuto', () => {
  it('skips a day that already has an AUTO report', async () => {
    const { svc, loader, create } = make({ existing: { id: 1 } });
    expect(await svc.generateAuto('2026-09-30')).toBeNull();
    expect(loader.load).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('treats a unique-index race (P2002) as already done', async () => {
    const { svc } = make({
      createError: Object.assign(new Error('dup'), { code: 'P2002' }),
    });
    expect(await svc.generateAuto('2026-09-30')).toBeNull();
  });

  it('creates an AUTO report named for the day', async () => {
    const { svc, create } = make();
    const r = await svc.generateAuto('2026-09-30');
    expect(r?.name).toBe('Daily – 30 Sep 2026');
    expect(create.mock.calls[0][0].data).toMatchObject({
      kind: 'AUTO',
      createdByName: null,
    });
  });
});

describe('DailyReportService.nightly', () => {
  it('still builds yesterday when the purge fails', async () => {
    const { svc, create } = make({ purgeError: new Error('db blip') });
    await svc.nightly();
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data).toMatchObject({ kind: 'AUTO' });
  });

  it('a retry run after a success is a no-op', async () => {
    const { svc, create } = make({ existing: { id: 1 } });
    await svc.nightly();
    expect(create).not.toHaveBeenCalled();
  });
});

describe('DailyReportService business day', () => {
  afterEach(() => jest.useRealTimers());

  it('the 8:15 PM run builds the day that just closed (today)', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-02T14:15:00Z')); // 8:15 PM Dhaka
    const { svc, create } = make();
    await svc.nightly();
    expect(create.mock.calls[0][0].data).toMatchObject({
      kind: 'AUTO',
      name: 'Daily – 2 Oct 2026',
      periodFrom: new Date('2026-10-02T00:00:00Z'),
    });
  });

  it('after 8 PM, the open business day is tomorrow, so it is not "future"', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-02T15:00:00Z')); // 9 PM Dhaka
    const { svc, create } = make();
    const prisma = (
      svc as unknown as { prisma: { client: Record<string, unknown> } }
    ).prisma;
    prisma.client.adminUser = { findUnique: jest.fn().mockResolvedValue(null) };
    await svc.generateManual(
      { name: 'Tonight', from: '2026-10-03', to: '2026-10-03' },
      1,
    );
    expect(create).toHaveBeenCalledTimes(1);
  });
});
