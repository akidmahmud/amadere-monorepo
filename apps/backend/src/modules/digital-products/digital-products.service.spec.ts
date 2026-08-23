import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DigitalProductsService } from './digital-products.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MEDIA_STORAGE } from '../media/storage/media-storage.interface';
import { DIGITAL_PREVIEW_PAGES_DEFAULT, DIGITAL_PREVIEW_PAGES_MAX } from '@amader/shared';
import { renderPreviewPages } from './pdf-preview.util';

function createMockPrismaService() {
  const client = {
    product: { findUnique: jest.fn(), update: jest.fn() },
    productPreviewPage: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    // Tests run against a plain object, not a real Prisma client, so
    // $transaction just invokes the callback with that same object as `tx`
    // — every tx.<model> call lands on the mocks above, same as a
    // non-transactional call would.
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(client)),
  };
  return { client };
}

type MockPrisma = ReturnType<typeof createMockPrismaService>;

function pdfFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    originalname: 'my book.pdf',
    mimetype: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 fake'),
    size: 1234,
    ...overrides,
  } as Express.Multer.File;
}

// The mocked renderer echoes the range it was asked for, so the service's
// own page numbering (and the "actually rendered" end page it stores) is
// exercised rather than being hard-coded by the mock.
jest.mock('./pdf-preview.util', () => ({
  readPageCount: jest.fn().mockResolvedValue(42),
  renderPreviewPages: jest.fn((_buf: Buffer, start: number, end: number) =>
    Promise.resolve(
      Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => ({
        pageNumber: start + i,
        image: Buffer.from(`page-${start + i}`),
      })),
    ),
  ),
}));

const mockedRenderPreviewPages = renderPreviewPages as jest.Mock;

describe('DigitalProductsService', () => {
  let service: DigitalProductsService;
  let prisma: MockPrisma;
  let storage: { upload: jest.Mock; uploadPrivate: jest.Mock; getObjectStream: jest.Mock; delete: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrismaService();
    storage = {
      upload: jest.fn().mockResolvedValue({ url: 'https://cdn.test/image/p.png' }),
      uploadPrivate: jest.fn().mockImplementation((key: string) => Promise.resolve({ key })),
      getObjectStream: jest.fn(),
      delete: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DigitalProductsService,
        { provide: PrismaService, useValue: prisma },
        { provide: MEDIA_STORAGE, useValue: storage },
      ],
    }).compile();
    service = module.get(DigitalProductsService);
    prisma.client.product.findUnique.mockResolvedValue({
      id: 1,
      productType: 'DIGITAL',
      digitalPreviewStartPage: null,
      digitalPreviewEndPage: null,
    });
    prisma.client.product.update.mockResolvedValue({ id: 1 });
    mockedRenderPreviewPages.mockClear();
  });

  it('stores the PDF privately and never records a public url', async () => {
    await service.attachFile(1, pdfFile());
    expect(storage.uploadPrivate).toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalledWith(
      expect.stringContaining('.pdf'), expect.anything(), 'application/pdf',
    );
    const saved = prisma.client.product.update.mock.calls[0][0].data;
    expect(saved.digitalFileKey).toMatch(/^digital\//);
    expect(saved.digitalFileKey).not.toMatch(/^https?:/);
  });

  it('sanitizes the filename so a space cannot break the key', async () => {
    await service.attachFile(1, pdfFile());
    const key = prisma.client.product.update.mock.calls[0][0].data.digitalFileKey;
    expect(key).not.toContain(' ');
    expect(key).toContain('my-book.pdf');
  });

  it('records the real page count and the original filename', async () => {
    await service.attachFile(1, pdfFile());
    const saved = prisma.client.product.update.mock.calls[0][0].data;
    expect(saved.digitalPageCount).toBe(42);
    expect(saved.digitalFileName).toBe('my book.pdf');
    expect(saved.digitalFileSize).toBe(1234);
  });

  it('uploads preview pages to the PUBLIC path — they are the free sample', async () => {
    await service.attachFile(1, pdfFile());
    expect(storage.upload).toHaveBeenCalled();
    expect(prisma.client.productPreviewPage.createMany).toHaveBeenCalled();
  });

  it('defaults a fresh upload to the range 1..DIGITAL_PREVIEW_PAGES_DEFAULT', async () => {
    await service.attachFile(1, pdfFile());
    expect(mockedRenderPreviewPages).toHaveBeenCalledWith(
      expect.any(Buffer), 1, DIGITAL_PREVIEW_PAGES_DEFAULT,
    );
    const saved = prisma.client.product.update.mock.calls[0][0].data;
    expect(saved.digitalPreviewStartPage).toBe(1);
    expect(saved.digitalPreviewEndPage).toBe(DIGITAL_PREVIEW_PAGES_DEFAULT);
  });

  it('keeps the admin\'s existing range across a re-upload that still fits it', async () => {
    prisma.client.product.findUnique.mockResolvedValue({
      id: 1, productType: 'DIGITAL', digitalPreviewStartPage: 5, digitalPreviewEndPage: 9,
    });
    await service.attachFile(1, pdfFile());
    expect(mockedRenderPreviewPages).toHaveBeenCalledWith(expect.any(Buffer), 5, 9);
  });

  it('pulls a stale range back inside a shorter replacement document', async () => {
    // readPageCount is mocked at 42; a stored 60..70 range cannot survive.
    prisma.client.product.findUnique.mockResolvedValue({
      id: 1, productType: 'DIGITAL', digitalPreviewStartPage: 60, digitalPreviewEndPage: 70,
    });
    await service.attachFile(1, pdfFile());
    const saved = prisma.client.product.update.mock.calls[0][0].data;
    expect(saved.digitalPreviewStartPage).toBe(1);
    expect(saved.digitalPreviewEndPage).toBeLessThanOrEqual(42);
  });

  it('stores each preview row under its real page number, not 1..n', async () => {
    prisma.client.product.findUnique.mockResolvedValue({
      id: 1, productType: 'DIGITAL', digitalPreviewStartPage: 5, digitalPreviewEndPage: 9,
    });
    await service.attachFile(1, pdfFile());
    const rows = prisma.client.productPreviewPage.createMany.mock.calls[0][0].data;
    expect(rows.map((r: { pageNumber: number }) => r.pageNumber)).toEqual([5, 6, 7, 8, 9]);
  });

  it('replaces previous preview pages rather than appending', async () => {
    await service.attachFile(1, pdfFile());
    expect(prisma.client.productPreviewPage.deleteMany).toHaveBeenCalledWith({ where: { productId: 1 } });
  });

  it('deletes the superseded preview objects from storage, not just their rows', async () => {
    // Preview URLs are public — a row deleted from the DB without also
    // deleting the R2 object it points at would still be fetchable forever.
    prisma.client.productPreviewPage.findMany.mockResolvedValue([
      { imageUrl: 'https://cdn.test/image/preview-1-1-old.png' },
      { imageUrl: 'https://cdn.test/image/preview-1-2-old.png' },
    ]);
    await service.attachFile(1, pdfFile());
    expect(storage.delete).toHaveBeenCalledWith('image/preview-1-1-old.png');
    expect(storage.delete).toHaveBeenCalledWith('image/preview-1-2-old.png');
  });

  it('rejects a non-PDF', async () => {
    await expect(
      service.attachFile(1, pdfFile({ mimetype: 'image/png' })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a product that is not DIGITAL', async () => {
    prisma.client.product.findUnique.mockResolvedValue({ id: 1, productType: 'PHYSICAL' });
    await expect(service.attachFile(1, pdfFile())).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404s for a product that does not exist', async () => {
    prisma.client.product.findUnique.mockResolvedValue(null);
    await expect(service.attachFile(1, pdfFile())).rejects.toBeInstanceOf(NotFoundException);
  });

  it('re-renders previews when the preview range changes', async () => {
    prisma.client.product.findUnique.mockResolvedValue({
      id: 1, productType: 'DIGITAL', digitalFileKey: 'digital/x.pdf', digitalPageCount: 42,
    });
    storage.getObjectStream.mockResolvedValue(null);
    storage.upload.mockClear();

    await expect(service.setPreviewRange(1, 5, 9)).resolves.toBeDefined();

    // Not just "it resolved and update() was called" — that's true even if
    // rendering were silently skipped. Assert the actual re-render happened
    // over the new range, that one object per page was uploaded, and that the
    // stored range and the rows agree.
    expect(mockedRenderPreviewPages).toHaveBeenCalledWith(expect.any(Buffer), 5, 9);
    expect(storage.upload).toHaveBeenCalledTimes(5);
    const rows = prisma.client.productPreviewPage.createMany.mock.calls[0][0].data;
    expect(rows.map((r: { pageNumber: number }) => r.pageNumber)).toEqual([5, 6, 7, 8, 9]);
    expect(prisma.client.product.update.mock.calls[0][0].data).toEqual({
      digitalPreviewStartPage: 5,
      digitalPreviewEndPage: 9,
    });
  });

  it('replaces the previous rows rather than colliding on the unique page number', async () => {
    // The old and new ranges overlap on pages 4-5, which would violate
    // @@unique([productId, pageNumber]) if the rows were appended instead of
    // replaced. The delete must therefore happen inside the same transaction,
    // before the insert.
    prisma.client.product.findUnique.mockResolvedValue({
      id: 1, productType: 'DIGITAL', digitalFileKey: 'digital/x.pdf', digitalPageCount: 42,
      digitalPreviewStartPage: 4, digitalPreviewEndPage: 8,
    });
    storage.getObjectStream.mockResolvedValue(null);

    await service.setPreviewRange(1, 2, 5);

    const order = [
      prisma.client.productPreviewPage.deleteMany.mock.invocationCallOrder[0],
      prisma.client.productPreviewPage.createMany.mock.invocationCallOrder[0],
    ];
    expect(order[0]).toBeLessThan(order[1]);
    expect(prisma.client.productPreviewPage.deleteMany).toHaveBeenCalledWith({ where: { productId: 1 } });
  });

  it('refuses an end page beyond the document, naming the document length', async () => {
    prisma.client.product.findUnique.mockResolvedValue({
      id: 1, productType: 'DIGITAL', digitalFileKey: 'digital/x.pdf', digitalPageCount: 48,
    });
    await expect(service.setPreviewRange(1, 40, 60)).rejects.toThrow(/48 pages/);
    await expect(service.setPreviewRange(1, 40, 60)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses an end page before the start page', async () => {
    prisma.client.product.findUnique.mockResolvedValue({
      id: 1, productType: 'DIGITAL', digitalFileKey: 'digital/x.pdf', digitalPageCount: 42,
    });
    await expect(service.setPreviewRange(1, 9, 5)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a start page below 1', async () => {
    prisma.client.product.findUnique.mockResolvedValue({
      id: 1, productType: 'DIGITAL', digitalFileKey: 'digital/x.pdf', digitalPageCount: 42,
    });
    await expect(service.setPreviewRange(1, 0, 5)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a range longer than the shared maximum', async () => {
    prisma.client.product.findUnique.mockResolvedValue({
      id: 1, productType: 'DIGITAL', digitalFileKey: 'digital/x.pdf', digitalPageCount: 1000,
    });
    // Well inside the document, so only the LENGTH cap can reject this.
    await expect(
      service.setPreviewRange(1, 100, 100 + DIGITAL_PREVIEW_PAGES_MAX),
    ).rejects.toThrow(new RegExp(`at most ${DIGITAL_PREVIEW_PAGES_MAX} pages`));
    // ...and the same length one page shorter is accepted.
    storage.getObjectStream.mockResolvedValue(null);
    await expect(
      service.setPreviewRange(1, 100, 100 + DIGITAL_PREVIEW_PAGES_MAX - 1),
    ).resolves.toBeDefined();
  });

  it('removeFile deletes the PDF, the preview rows and their objects, and clears every digital field', async () => {
    prisma.client.product.findUnique.mockResolvedValue({
      id: 1,
      productType: 'DIGITAL',
      digitalFileKey: 'digital/x.pdf',
      digitalPageCount: 42,
      digitalPreviewStartPage: 5,
      digitalPreviewEndPage: 9,
    });
    prisma.client.productPreviewPage.findMany.mockResolvedValue([
      { imageUrl: 'https://cdn.test/image/preview-1-1-old.png' },
    ]);

    await service.removeFile(1);

    expect(storage.delete).toHaveBeenCalledWith('digital/x.pdf');
    expect(storage.delete).toHaveBeenCalledWith('image/preview-1-1-old.png');
    expect(prisma.client.productPreviewPage.deleteMany).toHaveBeenCalledWith({ where: { productId: 1 } });
    expect(prisma.client.product.update.mock.calls[0][0].data).toEqual({
      digitalFileKey: null,
      digitalFileName: null,
      digitalFileSize: null,
      digitalPageCount: null,
      digitalPreviewStartPage: null,
      digitalPreviewEndPage: null,
    });
  });
});
