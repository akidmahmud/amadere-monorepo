import { StoresService } from './stores.service';

describe('StoresService.list — staff privacy', () => {
  const rows = [
    {
      id: 1,
      name: 'A',
      staff: [{ id: 7, firstName: 'X', lastName: 'Y', email: 'x@y.z' }],
    },
  ];
  const prisma = {
    client: { store: { findMany: jest.fn().mockResolvedValue(rows) } },
  };
  const svc = new StoresService(prisma as never);

  it('store managers see staff (with emails)', async () => {
    const out = await svc.list(true);
    expect(out[0].staff).toHaveLength(1);
    expect(out[0].staffCount).toBe(1);
  });

  it('everyone else gets only a staff count', async () => {
    const out = await svc.list(false);
    expect(out[0].staff).toEqual([]);
    expect(out[0].staffCount).toBe(1);
  });
});
