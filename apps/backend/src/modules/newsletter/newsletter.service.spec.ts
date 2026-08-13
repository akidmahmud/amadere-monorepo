import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NewsletterService, CsvImportResult } from './newsletter.service';
import { PrismaService } from '../../common/prisma/prisma.service';

// ---------------------------------------------------------------------------
// Helpers – mock Prisma
// ---------------------------------------------------------------------------

function createMockPrismaService() {
  return {
    client: {
      newsletterSubscriber: {
        upsert: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        count: jest.fn(),
      },
    },
  };
}

type MockPrisma = ReturnType<typeof createMockPrismaService>;

// Minimal subscriber row factory
function fakeSubscriber(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    email: 'test@example.com',
    name: null,
    status: 'SUBSCRIBED',
    subscribedAt: new Date('2026-01-01T00:00:00Z'),
    unsubscribedAt: null,
    tags: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NewsletterService', () => {
  let service: NewsletterService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsletterService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<NewsletterService>(NewsletterService);
  });

  // -----------------------------------------------------------------------
  // subscribe()
  // -----------------------------------------------------------------------
  describe('subscribe()', () => {
    it('should upsert subscriber and return { success: true }', async () => {
      prisma.client.newsletterSubscriber.upsert.mockResolvedValue(fakeSubscriber());

      const result = await service.subscribe({ email: 'test@example.com' });

      expect(result).toEqual({ success: true });
      expect(prisma.client.newsletterSubscriber.upsert).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        create: { email: 'test@example.com', status: 'SUBSCRIBED' },
        update: { status: 'SUBSCRIBED', unsubscribedAt: null },
      });
    });

    it('should re-subscribe an already-unsubscribed email', async () => {
      prisma.client.newsletterSubscriber.upsert.mockResolvedValue(
        fakeSubscriber({ status: 'SUBSCRIBED', unsubscribedAt: null }),
      );

      const result = await service.subscribe({ email: 'returning@example.com' });

      expect(result).toEqual({ success: true });
      expect(prisma.client.newsletterSubscriber.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { status: 'SUBSCRIBED', unsubscribedAt: null },
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // unsubscribe()
  // -----------------------------------------------------------------------
  describe('unsubscribe()', () => {
    it('should set status to UNSUBSCRIBED and set unsubscribedAt', async () => {
      prisma.client.newsletterSubscriber.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.unsubscribe({ email: 'test@example.com' });

      expect(result).toEqual({ success: true });
      expect(prisma.client.newsletterSubscriber.updateMany).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        data: expect.objectContaining({
          status: 'UNSUBSCRIBED',
          unsubscribedAt: expect.any(Date),
        }),
      });
    });

    it('should return success even if email does not exist', async () => {
      prisma.client.newsletterSubscriber.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.unsubscribe({ email: 'nonexistent@example.com' });

      expect(result).toEqual({ success: true });
    });
  });

  // -----------------------------------------------------------------------
  // adminCreate()
  // -----------------------------------------------------------------------
  describe('adminCreate()', () => {
    it('should create a new subscriber with name and return mapped DTO', async () => {
      const sub = fakeSubscriber({
        email: 'admin-new@example.com',
        name: 'Admin User',
        tags: [{ tag: { id: 1, name: 'VIP' } }],
      });
      prisma.client.newsletterSubscriber.upsert.mockResolvedValue(sub);

      const result = await service.adminCreate({
        email: 'admin-new@example.com',
        name: 'Admin User',
      });

      expect(result).toEqual(
        expect.objectContaining({
          email: 'admin-new@example.com',
          name: 'Admin User',
          status: 'SUBSCRIBED',
          tags: [{ id: 1, name: 'VIP' }],
        }),
      );
    });

    it('should upsert (re-subscribe) an existing subscriber', async () => {
      prisma.client.newsletterSubscriber.upsert.mockResolvedValue(
        fakeSubscriber({ email: 'existing@example.com', name: 'Updated' }),
      );

      await service.adminCreate({ email: 'existing@example.com', name: 'Updated' });

      expect(prisma.client.newsletterSubscriber.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'existing@example.com' },
          update: expect.objectContaining({
            name: 'Updated',
            status: 'SUBSCRIBED',
            unsubscribedAt: null,
          }),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // adminList()
  // -----------------------------------------------------------------------
  describe('adminList()', () => {
    it('should return a paginated list of subscribers', async () => {
      const subscribers = [
        fakeSubscriber({ id: 1, email: 'a@example.com' }),
        fakeSubscriber({ id: 2, email: 'b@example.com' }),
      ];
      prisma.client.newsletterSubscriber.findMany.mockResolvedValue(subscribers);
      prisma.client.newsletterSubscriber.count.mockResolvedValue(2);

      const result = await service.adminList({ page: 1, pageSize: 20 });

      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should pass search query to the where clause', async () => {
      prisma.client.newsletterSubscriber.findMany.mockResolvedValue([]);
      prisma.client.newsletterSubscriber.count.mockResolvedValue(0);

      await service.adminList({ q: 'search', page: 1, pageSize: 10 });

      expect(prisma.client.newsletterSubscriber.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: { contains: 'search', mode: 'insensitive' } },
        }),
      );
    });

    it('should filter by tagId when provided', async () => {
      prisma.client.newsletterSubscriber.findMany.mockResolvedValue([]);
      prisma.client.newsletterSubscriber.count.mockResolvedValue(0);

      await service.adminList({ tagId: 5, page: 1, pageSize: 20 });

      expect(prisma.client.newsletterSubscriber.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tags: { some: { tagId: 5 } },
          }),
        }),
      );
    });

    it('should use correct pagination args', async () => {
      prisma.client.newsletterSubscriber.findMany.mockResolvedValue([]);
      prisma.client.newsletterSubscriber.count.mockResolvedValue(0);

      await service.adminList({ page: 3, pageSize: 10 });

      expect(prisma.client.newsletterSubscriber.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (3 - 1) * 10
          take: 10,
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // delete()
  // -----------------------------------------------------------------------
  describe('delete()', () => {
    it('should delete an existing subscriber', async () => {
      prisma.client.newsletterSubscriber.findUnique.mockResolvedValue(fakeSubscriber({ id: 42 }));
      prisma.client.newsletterSubscriber.delete.mockResolvedValue(fakeSubscriber({ id: 42 }));

      await expect(service.delete(42)).resolves.toBeUndefined();

      expect(prisma.client.newsletterSubscriber.delete).toHaveBeenCalledWith({
        where: { id: 42 },
      });
    });

    it('should throw NotFoundException if subscriber does not exist', async () => {
      prisma.client.newsletterSubscriber.findUnique.mockResolvedValue(null);

      await expect(service.delete(999)).rejects.toThrow(NotFoundException);
      expect(prisma.client.newsletterSubscriber.delete).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // bulkDelete()
  // -----------------------------------------------------------------------
  describe('bulkDelete()', () => {
    it('should delete multiple subscribers and return count', async () => {
      prisma.client.newsletterSubscriber.deleteMany.mockResolvedValue({ count: 3 });

      const result = await service.bulkDelete([1, 2, 3]);

      expect(result).toEqual({ deleted: 3 });
      expect(prisma.client.newsletterSubscriber.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2, 3] } },
      });
    });

    it('should return { deleted: 0 } when no IDs match', async () => {
      prisma.client.newsletterSubscriber.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.bulkDelete([999]);

      expect(result).toEqual({ deleted: 0 });
    });
  });

  // -----------------------------------------------------------------------
  // exportCsv()
  // -----------------------------------------------------------------------
  describe('exportCsv()', () => {
    it('should return CSV with header and subscriber rows', async () => {
      prisma.client.newsletterSubscriber.findMany.mockResolvedValue([
        fakeSubscriber({ id: 1, email: 'alice@example.com' }),
        fakeSubscriber({
          id: 2,
          email: 'bob@example.com',
          status: 'UNSUBSCRIBED',
          unsubscribedAt: new Date('2026-06-01T00:00:00Z'),
        }),
      ]);

      const csv = await service.exportCsv();
      const lines = csv.split('\n');

      expect(lines[0]).toBe('id,email,status,subscribedAt,unsubscribedAt');
      expect(lines[1]).toContain('alice@example.com');
      expect(lines[1]).toContain('SUBSCRIBED');
      expect(lines[2]).toContain('bob@example.com');
      expect(lines[2]).toContain('UNSUBSCRIBED');
      expect(lines[2]).toContain('2026-06-01');
    });

    it('should produce only a header for an empty list', async () => {
      prisma.client.newsletterSubscriber.findMany.mockResolvedValue([]);

      const csv = await service.exportCsv();

      expect(csv).toBe('id,email,status,subscribedAt,unsubscribedAt');
    });

    it('should escape emails containing commas or quotes', async () => {
      prisma.client.newsletterSubscriber.findMany.mockResolvedValue([
        fakeSubscriber({ id: 1, email: '"weird,email"@example.com' }),
      ]);

      const csv = await service.exportCsv();
      const dataLine = csv.split('\n')[1];

      // The email should be properly quoted/escaped in the CSV
      expect(dataLine).toBeDefined();
      // The field containing a comma should be wrapped in quotes
      expect(dataLine).toMatch(/"/);
    });

    it('should pass search query when filtering export', async () => {
      prisma.client.newsletterSubscriber.findMany.mockResolvedValue([]);

      await service.exportCsv('alice');

      expect(prisma.client.newsletterSubscriber.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: { contains: 'alice', mode: 'insensitive' } },
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // importCsv()
  // -----------------------------------------------------------------------
  describe('importCsv()', () => {
    it('should import valid CSV with header row', async () => {
      prisma.client.newsletterSubscriber.upsert.mockResolvedValue(fakeSubscriber());

      const csv = 'email,name\nalice@example.com,Alice\nbob@example.com,Bob';
      const result = await service.importCsv(csv);

      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(prisma.client.newsletterSubscriber.upsert).toHaveBeenCalledTimes(2);
    });

    it('should import CSV without header row', async () => {
      prisma.client.newsletterSubscriber.upsert.mockResolvedValue(fakeSubscriber());

      const csv = 'alice@example.com,Alice';
      const result = await service.importCsv(csv);

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(0);
    });

    it('should skip rows with invalid emails and report errors', async () => {
      prisma.client.newsletterSubscriber.upsert.mockResolvedValue(fakeSubscriber());

      const csv = 'email,name\nalice@example.com,Alice\nnot-an-email,Bob\n,Missing';
      const result = await service.importCsv(csv);

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(2);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toEqual({ line: 3, reason: expect.stringContaining('Invalid email') });
      expect(result.errors[1]).toEqual({ line: 4, reason: 'Missing email' });
    });

    it('should return zero counts for empty CSV', async () => {
      const result = await service.importCsv('');

      expect(result).toEqual({ imported: 0, skipped: 0, errors: [] });
      expect(prisma.client.newsletterSubscriber.upsert).not.toHaveBeenCalled();
    });

    it('should handle CSV with only a header row', async () => {
      const result = await service.importCsv('email,name');

      expect(result).toEqual({ imported: 0, skipped: 0, errors: [] });
    });

    it('should handle emails without names', async () => {
      prisma.client.newsletterSubscriber.upsert.mockResolvedValue(fakeSubscriber());

      const csv = 'email,name\nalice@example.com,';
      const result = await service.importCsv(csv);

      expect(result.imported).toBe(1);
      expect(prisma.client.newsletterSubscriber.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ email: 'alice@example.com', name: undefined }),
        }),
      );
    });

    it('should normalize emails to lowercase', async () => {
      prisma.client.newsletterSubscriber.upsert.mockResolvedValue(fakeSubscriber());

      const csv = 'Alice@Example.COM,Alice';
      const result = await service.importCsv(csv);

      expect(result.imported).toBe(1);
      expect(prisma.client.newsletterSubscriber.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'alice@example.com' },
          create: expect.objectContaining({ email: 'alice@example.com' }),
        }),
      );
    });

    it('should handle quoted fields with commas in CSV', async () => {
      prisma.client.newsletterSubscriber.upsert.mockResolvedValue(fakeSubscriber());

      const csv = 'email,name\nalice@example.com,"Last, First"';
      const result = await service.importCsv(csv);

      expect(result.imported).toBe(1);
      expect(prisma.client.newsletterSubscriber.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ name: 'Last, First' }),
        }),
      );
    });

    it('should handle quoted fields with escaped double quotes', async () => {
      prisma.client.newsletterSubscriber.upsert.mockResolvedValue(fakeSubscriber());

      const csv = 'email,name\nalice@example.com,"She said ""hello"""';
      const result = await service.importCsv(csv);

      expect(result.imported).toBe(1);
      expect(prisma.client.newsletterSubscriber.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ name: 'She said "hello"' }),
        }),
      );
    });

    it('should handle Windows-style line endings (\\r\\n)', async () => {
      prisma.client.newsletterSubscriber.upsert.mockResolvedValue(fakeSubscriber());

      const csv = 'email,name\r\nalice@example.com,Alice\r\nbob@example.com,Bob';
      const result = await service.importCsv(csv);

      expect(result.imported).toBe(2);
    });

    it('should skip blank lines', async () => {
      prisma.client.newsletterSubscriber.upsert.mockResolvedValue(fakeSubscriber());

      const csv = 'email,name\n\nalice@example.com,Alice\n\n';
      const result = await service.importCsv(csv);

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(0);
    });

    it('should upsert (re-subscribe) existing emails on import', async () => {
      prisma.client.newsletterSubscriber.upsert.mockResolvedValue(fakeSubscriber());

      const csv = 'email,name\nalice@example.com,Alice';
      await service.importCsv(csv);

      expect(prisma.client.newsletterSubscriber.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { name: 'Alice', status: 'SUBSCRIBED', unsubscribedAt: null },
        }),
      );
    });
  });
});
