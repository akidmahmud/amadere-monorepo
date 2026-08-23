import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { MastersService } from './masters.service';
import { PrismaService } from '../../../../common/prisma/prisma.service';

describe('MastersService', () => {
  let service: MastersService;
  let prisma: {
    client: {
      expenseCategory: Record<string, jest.Mock>;
      costCentre: Record<string, jest.Mock>;
      periodLock: Record<string, jest.Mock>;
    };
  };

  beforeEach(async () => {
    prisma = {
      client: {
        expenseCategory: {
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn(),
          update: jest.fn(),
          findFirst: jest.fn().mockResolvedValue(null),
        },
        costCentre: {
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn(),
          update: jest.fn(),
          findFirst: jest.fn().mockResolvedValue(null),
        },
        periodLock: {
          findMany: jest.fn().mockResolvedValue([]),
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn(),
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [MastersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(MastersService);
  });

  describe('expense categories', () => {
    it('hides inactive categories by default', async () => {
      await service.listCategories();
      expect(prisma.client.expenseCategory.findMany.mock.calls[0][0].where).toEqual({ isActive: true });
    });

    it('includes inactive categories when asked', async () => {
      await service.listCategories(true);
      expect(prisma.client.expenseCategory.findMany.mock.calls[0][0].where).toEqual({});
    });

    it('rejects a duplicate category name case-insensitively', async () => {
      prisma.client.expenseCategory.findFirst.mockResolvedValue({ id: 1, name: 'Rent' });
      await expect(service.createCategory({ name: 'rent' })).rejects.toThrow(BadRequestException);
    });

    it('deactivates rather than deleting, so historical vouchers keep their category', async () => {
      prisma.client.expenseCategory.update.mockResolvedValue({
        id: 1, name: 'Rent', isVatClaimable: true, isActive: false, sortOrder: 0,
      });
      const dto = await service.updateCategory(1, { isActive: false });
      expect(dto.isActive).toBe(false);
    });

    it('lets a category keep its own name on rename', async () => {
      prisma.client.expenseCategory.update.mockResolvedValue({
        id: 1, name: 'Rent', isVatClaimable: true, isActive: true, sortOrder: 0,
      });
      await service.updateCategory(1, { name: 'Rent' });
      expect(prisma.client.expenseCategory.findFirst.mock.calls[0][0].where.id).toEqual({ not: 1 });
    });
  });

  describe('cost centres', () => {
    it('rejects a duplicate cost centre name', async () => {
      prisma.client.costCentre.findFirst.mockResolvedValue({ id: 1, name: 'Head Office' });
      await expect(service.createCostCentre({ name: 'head office' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('period locks', () => {
    it('normalises any date in the month to the first of that month', async () => {
      // LedgerService.assertPeriodOpen matches on the first of the month, so
      // a lock stored on the 15th would silently never match.
      prisma.client.periodLock.create.mockResolvedValue({
        id: 1, month: new Date('2026-08-01'), lockedAt: new Date(), lockedBy: 7, note: null,
      });
      await service.lockPeriod('2026-08-15', 7);
      const stored = prisma.client.periodLock.create.mock.calls[0][0].data.month as Date;
      expect(stored.toISOString().slice(0, 10)).toBe('2026-08-01');
    });

    it('refuses to lock the same month twice', async () => {
      prisma.client.periodLock.findFirst.mockResolvedValue({ id: 1, month: new Date('2026-08-01') });
      await expect(service.lockPeriod('2026-08-15', 7)).rejects.toThrow(BadRequestException);
    });

    it('unlocks by removing the row for the normalised month', async () => {
      await service.unlockPeriod('2026-08-31');
      const where = prisma.client.periodLock.deleteMany.mock.calls[0][0].where.month as Date;
      expect(where.toISOString().slice(0, 10)).toBe('2026-08-01');
    });

    it('rejects an unparseable month', async () => {
      await expect(service.lockPeriod('not-a-date', 7)).rejects.toThrow(BadRequestException);
    });
  });
});
