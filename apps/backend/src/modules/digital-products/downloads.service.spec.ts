import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DownloadsService } from './downloads.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MEDIA_STORAGE } from '../media/storage/media-storage.interface';
import { OrderEmailsService } from '../order-emails/order-emails.service';

function createMockPrismaService() {
  return {
    client: {
      order: { findUnique: jest.fn() },
      digitalDownload: {
        createMany: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    },
  };
}

describe('DownloadsService', () => {
  let service: DownloadsService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let storage: { getObjectStream: jest.Mock };
  let orderEmails: { sendDigitalDownload: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrismaService();
    storage = { getObjectStream: jest.fn().mockResolvedValue('STREAM') };
    orderEmails = { sendDigitalDownload: jest.fn().mockResolvedValue([{ sent: true }]) };
    prisma.client.digitalDownload.updateMany.mockResolvedValue({ count: 1 });
    prisma.client.digitalDownload.findMany.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DownloadsService,
        { provide: PrismaService, useValue: prisma },
        { provide: MEDIA_STORAGE, useValue: storage },
        { provide: OrderEmailsService, useValue: orderEmails },
      ],
    }).compile();
    service = module.get(DownloadsService);
  });

  it('creates one locked download per digital line', async () => {
    prisma.client.order.findUnique.mockResolvedValue({
      id: 7, customerId: 3,
      items: [
        { productId: 10, productTypeSnapshot: 'DIGITAL' },
        { productId: 11, productTypeSnapshot: 'PHYSICAL' },
      ],
    });
    await service.createForOrder(7);
    const rows = prisma.client.digitalDownload.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(1);
    expect(rows[0].productId).toBe(10);
    // Locked until payment is confirmed.
    expect(rows[0].unlockedAt).toBeNull();
    expect(rows[0].token).toEqual(expect.any(String));
    expect(rows[0].token.length).toBeGreaterThanOrEqual(32);
  });

  it('creates nothing for an order with no digital lines', async () => {
    prisma.client.order.findUnique.mockResolvedValue({
      id: 8, customerId: null, items: [{ productId: 11, productTypeSnapshot: 'PHYSICAL' }],
    });
    await service.createForOrder(8);
    expect(prisma.client.digitalDownload.createMany).not.toHaveBeenCalled();
  });

  it('unlocks every download on the order', async () => {
    await service.unlockForOrder(7);
    expect(prisma.client.digitalDownload.updateMany).toHaveBeenCalledWith({
      where: { orderId: 7, unlockedAt: null },
      data: { unlockedAt: expect.any(Date) },
    });
  });

  it('emails the buyer exactly the tokens this call unlocked', async () => {
    prisma.client.digitalDownload.updateMany.mockResolvedValue({ count: 2 });
    prisma.client.digitalDownload.findMany.mockResolvedValue([
      { token: 'tok-a', productId: 10 },
      { token: 'tok-b', productId: 11 },
    ]);
    await service.unlockForOrder(7);
    const unlockedAt = prisma.client.digitalDownload.updateMany.mock.calls[0][0].data.unlockedAt;
    // Scoped by the exact timestamp just written, so a concurrent unlock (or
    // a later second unlock on the same order) can never re-email a token
    // that has already been delivered.
    expect(prisma.client.digitalDownload.findMany).toHaveBeenCalledWith({
      where: { orderId: 7, unlockedAt },
      select: { token: true, productId: true },
    });
    expect(orderEmails.sendDigitalDownload).toHaveBeenCalledWith(7, [
      { token: 'tok-a', productId: 10 },
      { token: 'tok-b', productId: 11 },
    ]);
  });

  // Regression guard for the leak this feature has already had three times:
  // the R2 bucket is fully public, so a Product row reaching any code path
  // other than streamByToken is a permanent unauthenticated download URL.
  it('never asks Prisma for the product row when collecting tokens to email', async () => {
    prisma.client.digitalDownload.updateMany.mockResolvedValue({ count: 1 });
    prisma.client.digitalDownload.findMany.mockResolvedValue([{ token: 'tok-a', productId: 10 }]);
    await service.unlockForOrder(7);
    const call = prisma.client.digitalDownload.findMany.mock.calls[0][0];
    expect(call.include).toBeUndefined();
    expect(Object.keys(call.select).sort()).toEqual(['productId', 'token']);
  });

  it('sends nothing when the unlock matched no rows (idempotent re-unlock)', async () => {
    prisma.client.digitalDownload.updateMany.mockResolvedValue({ count: 0 });
    await service.unlockForOrder(7);
    expect(prisma.client.digitalDownload.findMany).not.toHaveBeenCalled();
    expect(orderEmails.sendDigitalDownload).not.toHaveBeenCalled();
  });

  // The whole point of this task's error handling: a paid customer must not
  // be locked out of their purchase because the mail path fell over.
  it('still unlocks when sending the download email throws', async () => {
    prisma.client.digitalDownload.updateMany.mockResolvedValue({ count: 1 });
    prisma.client.digitalDownload.findMany.mockResolvedValue([{ token: 'tok-a', productId: 10 }]);
    orderEmails.sendDigitalDownload.mockRejectedValue(new Error('SMTP is down'));
    await expect(service.unlockForOrder(7)).resolves.toBeUndefined();
    expect(prisma.client.digitalDownload.updateMany).toHaveBeenCalledWith({
      where: { orderId: 7, unlockedAt: null },
      data: { unlockedAt: expect.any(Date) },
    });
  });

  it('streams a valid unlocked token and counts the download', async () => {
    prisma.client.digitalDownload.findUnique.mockResolvedValue({
      id: 1, unlockedAt: new Date(), downloadCount: 2,
      product: { digitalFileKey: 'digital/a.pdf', digitalFileName: 'book.pdf' },
    });
    const res = await service.streamByToken('tok');
    expect(res.filename).toBe('book.pdf');
    expect(storage.getObjectStream).toHaveBeenCalledWith('digital/a.pdf');
    // {increment: 1}, not a read-modify-write of the fetched value — see
    // this task's Fix round 1, Minor 1 (concurrent downloads must not race).
    expect(prisma.client.digitalDownload.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ downloadCount: { increment: 1 } }) }),
    );
  });

  it('refuses a locked token', async () => {
    prisma.client.digitalDownload.findUnique.mockResolvedValue({
      id: 1, unlockedAt: null, product: { digitalFileKey: 'digital/a.pdf' },
    });
    await expect(service.streamByToken('tok')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('404s an unknown token', async () => {
    prisma.client.digitalDownload.findUnique.mockResolvedValue(null);
    await expect(service.streamByToken('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404s when the product has lost its file', async () => {
    prisma.client.digitalDownload.findUnique.mockResolvedValue({
      id: 1, unlockedAt: new Date(), product: { digitalFileKey: null },
    });
    await expect(service.streamByToken('tok')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists only unlocked downloads for a customer', async () => {
    prisma.client.digitalDownload.findMany.mockResolvedValue([]);
    await service.listForCustomer(3);
    expect(prisma.client.digitalDownload.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { customerId: 3, unlockedAt: { not: null } } }),
    );
  });

  // Regression guard for the digitalFileKey leak fixed in this task (Fix
  // round 1, Finding 6): `where` alone (asserted above) still passes if this
  // reverts to `include: { product: true }` — Prisma is mocked here, so
  // nothing else would catch that. The bucket is fully public, so the
  // customer-facing list must keep using an explicit `select` that omits
  // digitalFileKey rather than pulling the whole Product row.
  it('never asks Prisma for the product digitalFileKey in the customer list', async () => {
    prisma.client.digitalDownload.findMany.mockResolvedValue([]);
    await service.listForCustomer(3);
    const call = prisma.client.digitalDownload.findMany.mock.calls[0][0];
    const productSelector = call.include.product;
    // Must be a `select` (an explicit allow-list), not `include: true` or a
    // nested `include`, either of which would pull every Product column.
    expect(productSelector.select).toBeDefined();
    expect(productSelector.include).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(productSelector.select, 'digitalFileKey')).toBe(false);
  });
});
