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

describe('StoresService.remove', () => {
  function make(store: object, counts: Partial<Record<string, number>> = {}) {
    const n = (k: string) => jest.fn().mockResolvedValue(counts[k] ?? 0);
    const tx = { store: { delete: jest.fn() }, costCentre: { delete: jest.fn() } };
    const client = {
      store: { findUniqueOrThrow: jest.fn().mockResolvedValue(store) },
      order: { count: n('order') },
      stockMovement: { count: n('mv') },
      stockIn: { count: n('in') },
      stockTransfer: { count: n('tr') },
      product: { count: n('product') },
      expense: { count: n('expense') },
      $transaction: (f: (t: typeof tx) => Promise<void>) => f(tx),
    };
    return { svc: new StoresService({ client } as never), tx };
  }

  it('deletes an unused store together with its cost centre', async () => {
    const { svc, tx } = make({ id: 5, isOnlineStore: false, costCentreId: 9 });
    await svc.remove(5);
    expect(tx.store.delete).toHaveBeenCalledWith({ where: { id: 5 } });
    expect(tx.costCentre.delete).toHaveBeenCalledWith({ where: { id: 9 } });
  });

  it('refuses a store with history and names what it has', async () => {
    const { svc, tx } = make(
      { id: 5, isOnlineStore: false, costCentreId: 9 },
      { order: 3, expense: 1 },
    );
    await expect(svc.remove(5)).rejects.toThrow(/3 sale\(s\), 1 expense\(s\)/);
    expect(tx.store.delete).not.toHaveBeenCalled();
  });

  it('never deletes the online store', async () => {
    const { svc } = make({ id: 1, isOnlineStore: true, costCentreId: null });
    await expect(svc.remove(1)).rejects.toThrow(/online store/);
  });
});
