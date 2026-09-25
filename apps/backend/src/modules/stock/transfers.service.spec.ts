import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { assertTransition, TransfersService } from './transfers.service';

describe('assertTransition', () => {
  it('allows the happy path', () => {
    expect(() => assertTransition('REQUESTED', 'APPROVED')).not.toThrow();
    expect(() => assertTransition('APPROVED', 'DISPATCHED')).not.toThrow();
    expect(() => assertTransition('DISPATCHED', 'RECEIVED')).not.toThrow();
  });

  it('refuses receiving twice, dispatching a cancelled transfer, cancelling goods in transit', () => {
    expect(() => assertTransition('RECEIVED', 'RECEIVED')).toThrow(
      BadRequestException,
    );
    expect(() => assertTransition('CANCELLED', 'DISPATCHED')).toThrow(
      BadRequestException,
    );
    // Goods in transit can be called back (stock returns to the source).
    expect(() => assertTransition('DISPATCHED', 'CANCELLED')).not.toThrow();
  });
});

describe('TransfersService', () => {
  const stock = { move: jest.fn() };
  const dispatched = {
    id: 5,
    status: 'DISPATCHED',
    fromStoreId: 1,
    toStoreId: 2,
    items: [{ id: 50, productId: 10, variantId: null, qty: 4 }],
  };
  const tx = {
    store: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 2, isActive: true }),
    },
    stockTransfer: {
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    stockTransferItem: { update: jest.fn() },
  };
  const prisma = {
    client: { $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)) },
  };
  const svc = new TransfersService(prisma as never, stock as never);

  beforeEach(() => {
    stock.move.mockReset();
    tx.stockTransfer.findUniqueOrThrow.mockResolvedValue(dispatched);
  });

  it('receive: credits only what arrived to the destination', async () => {
    await svc.receive(2, 5, [{ id: 50, receivedQty: 3 }], 9);
    expect(stock.move).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        storeId: 2,
        type: 'TRANSFER_IN',
        qty: 3,
        transferId: 5,
      }),
    );
    expect(tx.stockTransferItem.update).toHaveBeenCalledWith({
      where: { id: 50 },
      data: { receivedQty: 3 },
    });
  });

  it('receive: refuses when the caller is not the destination store', async () => {
    await expect(
      svc.receive(3, 5, [{ id: 50, receivedQty: 4 }], 9),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(stock.move).not.toHaveBeenCalled();
  });

  it('receive: refuses receiving more than was sent', async () => {
    await expect(
      svc.receive(2, 5, [{ id: 50, receivedQty: 5 }], 9),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('dispatch: takes stock out of the source store', async () => {
    tx.stockTransfer.findUniqueOrThrow.mockResolvedValue({
      ...dispatched,
      status: 'APPROVED',
    });
    await svc.dispatch(1, 5, 9);
    expect(stock.move).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ storeId: 1, type: 'TRANSFER_OUT', qty: -4 }),
    );
  });

  it('create: refuses same source and destination', async () => {
    await expect(
      svc.create(2, { toStoreId: 2, items: [{ productId: 1, qty: 1 }] }, 9),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('TransfersService.list', () => {
  it('attaches product names to lines', async () => {
    const prisma = {
      client: {
        stockTransfer: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 1,
              items: [{ id: 9, productId: 10, variantId: null, qty: 2 }],
            },
          ]),
        },
        product: {
          findMany: jest
            .fn()
            .mockResolvedValue([
              { id: 10, slug: 'coke', translations: [{ name: 'Coca-Cola' }] },
            ]),
        },
      },
    };
    const svc = new TransfersService(prisma as never, {} as never);
    const out = await svc.list(2);
    expect(out[0].items[0]).toEqual(
      expect.objectContaining({ productId: 10, name: 'Coca-Cola' }),
    );
  });
});

describe('TransfersService — concurrent clicks', () => {
  it('a second receive that loses the status claim moves no stock', async () => {
    const stock = { move: jest.fn() };
    const tx = {
      store: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ id: 2, isActive: true }),
      },
      stockTransfer: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 5,
          status: 'DISPATCHED',
          fromStoreId: 1,
          toStoreId: 2,
          items: [{ id: 50, productId: 10, variantId: null, qty: 4 }],
        }),
        // The other request already flipped it to RECEIVED.
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn(),
      },
      stockTransferItem: { update: jest.fn() },
    };
    const prisma = {
      client: {
        $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
      },
    };
    const svc = new TransfersService(prisma as never, stock as never);
    await expect(svc.receive(2, 5, [], 9)).rejects.toThrow(/already/);
    expect(stock.move).not.toHaveBeenCalled();
    expect(tx.stockTransfer.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 5, status: 'DISPATCHED' } }),
    );
  });

  it('a dispatch racing a cancel moves no stock', async () => {
    const stock = { move: jest.fn() };
    const tx = {
      store: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ id: 2, isActive: true }),
      },
      stockTransfer: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 5,
          status: 'APPROVED',
          fromStoreId: 1,
          toStoreId: 2,
          items: [{ id: 50, productId: 10, variantId: null, qty: 4 }],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn(),
      },
    };
    const prisma = {
      client: {
        $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
      },
    };
    const svc = new TransfersService(prisma as never, stock as never);
    await expect(svc.dispatch(1, 5, 9)).rejects.toThrow(/already/);
    expect(stock.move).not.toHaveBeenCalled();
  });
});

describe('TransfersService — scope and inactive stores', () => {
  function make(
    t: object,
    stores: Record<number, { isActive: boolean; code?: string }>,
  ) {
    const tx = {
      store: {
        findUniqueOrThrow: jest.fn(({ where }: { where: { id: number } }) =>
          Promise.resolve({ id: where.id, code: 'S', ...stores[where.id] }),
        ),
      },
      stockTransfer: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(t),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({ id: 1 }),
        update: jest.fn(),
      },
      stockTransferItem: { update: jest.fn() },
    };
    const prisma = {
      client: {
        $transaction: jest.fn((fn: (x: unknown) => unknown) => fn(tx)),
      },
    };
    return {
      svc: new TransfersService(prisma as never, { move: jest.fn() } as never),
      tx,
    };
  }
  const req = {
    id: 5,
    status: 'REQUESTED',
    fromStoreId: 1,
    toStoreId: 2,
    items: [],
  };

  it('approval is limited to the two stores involved (all-stores users excepted)', async () => {
    const { svc } = make(req, {});
    await expect(svc.approve(3, 5, 9)).rejects.toThrow(/other store|not your/i);
    await expect(svc.approve(1, 5, 9)).resolves.toBeDefined();
    await expect(svc.approve(null, 5, 9)).resolves.toBeDefined();
  });

  it('cannot request a transfer to or from an inactive store', async () => {
    const { svc } = make(req, { 2: { isActive: false } });
    await expect(
      svc.create(1, { toStoreId: 2, items: [{ productId: 1, qty: 1 }] }, 9),
    ).rejects.toThrow(/inactive/i);
  });

  it('an inactive destination cannot receive', async () => {
    const { svc } = make(
      { ...req, status: 'DISPATCHED' },
      { 2: { isActive: false } },
    );
    await expect(svc.receive(2, 5, [], 9)).rejects.toThrow(/inactive/i);
  });
});

describe('TransfersService — no stranded transfers', () => {
  it('refuses to create a transfer of a store-only product', async () => {
    const tx = {
      store: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ id: 1, code: 'S', isActive: true }),
      },
      product: {
        findMany: jest.fn().mockResolvedValue([{ id: 10, storeId: 1 }]),
      },
      stockTransfer: { create: jest.fn(), update: jest.fn() },
    };
    const prisma = {
      client: {
        $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
      },
    };
    const svc = new TransfersService(
      prisma as never,
      { move: jest.fn() } as never,
    );
    await expect(
      svc.create(1, { toStoreId: 2, items: [{ productId: 10, qty: 1 }] }, 9),
    ).rejects.toThrow(/only sold at/i);
    expect(tx.stockTransfer.create).not.toHaveBeenCalled();
  });

  it('a dispatched transfer can be cancelled; the stock goes back to the source store', async () => {
    const move = jest.fn();
    const tx = {
      stockTransfer: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 5,
          status: 'DISPATCHED',
          fromStoreId: 1,
          toStoreId: 2,
          items: [{ id: 50, productId: 10, variantId: null, qty: 4 }],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      client: {
        $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
      },
    };
    const svc = new TransfersService(prisma as never, { move } as never);
    await svc.cancel(1, 5, 9);
    expect(move).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        storeId: 1,
        type: 'TRANSFER_IN',
        qty: 4,
        transferId: 5,
      }),
    );
  });
});
