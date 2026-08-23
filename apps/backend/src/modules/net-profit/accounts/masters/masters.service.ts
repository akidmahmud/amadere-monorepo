import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { CreateMasterDto } from './dto/create-master.dto';

export interface ExpenseCategoryDto {
  id: number;
  name: string;
  isVatClaimable: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface CostCentreDto {
  id: number;
  name: string;
  code: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface PeriodLockDto {
  id: number;
  month: string; // YYYY-MM
  lockedAt: Date;
  lockedBy: number | null;
  note: string | null;
}

/**
 * The small lookup tables expenses depend on, plus period locks.
 *
 * Categories and cost centres are the same shape and always change together,
 * so they share a service rather than getting one file each.
 *
 * Neither has a delete endpoint: an expense voucher references its category
 * and must keep doing so. Deactivation hides it from new vouchers instead.
 *
 * PHASE 2 HOOK: recurring expense templates attach here — a
 * RecurringExpenseTemplate table plus a cron that creates the voucher.
 */
@Injectable()
export class MastersService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Expense categories -------------------------------------------------

  async listCategories(includeInactive = false): Promise<ExpenseCategoryDto[]> {
    return this.prisma.client.expenseCategory.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createCategory(dto: CreateMasterDto): Promise<ExpenseCategoryDto> {
    await this.assertCategoryNameFree(dto.name);
    return this.prisma.client.expenseCategory.create({
      data: {
        name: dto.name.trim(),
        isVatClaimable: dto.isVatClaimable ?? true,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateCategory(id: number, dto: Partial<CreateMasterDto>): Promise<ExpenseCategoryDto> {
    if (dto.name !== undefined) await this.assertCategoryNameFree(dto.name, id);
    return this.prisma.client.expenseCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.isVatClaimable !== undefined ? { isVatClaimable: dto.isVatClaimable } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
  }

  private async assertCategoryNameFree(name: string, excludeId?: number): Promise<void> {
    const clash = await this.prisma.client.expenseCategory.findFirst({
      where: {
        name: { equals: name.trim(), mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (clash) throw new BadRequestException(`Category "${clash.name}" already exists`);
  }

  // --- Cost centres -------------------------------------------------------

  async listCostCentres(includeInactive = false): Promise<CostCentreDto[]> {
    return this.prisma.client.costCentre.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createCostCentre(dto: CreateMasterDto): Promise<CostCentreDto> {
    await this.assertCostCentreNameFree(dto.name);
    return this.prisma.client.costCentre.create({
      data: {
        name: dto.name.trim(),
        code: dto.code ?? null,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateCostCentre(id: number, dto: Partial<CreateMasterDto>): Promise<CostCentreDto> {
    if (dto.name !== undefined) await this.assertCostCentreNameFree(dto.name, id);
    return this.prisma.client.costCentre.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
  }

  private async assertCostCentreNameFree(name: string, excludeId?: number): Promise<void> {
    const clash = await this.prisma.client.costCentre.findFirst({
      where: {
        name: { equals: name.trim(), mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (clash) throw new BadRequestException(`Cost centre "${clash.name}" already exists`);
  }

  // --- Period locks -------------------------------------------------------

  /**
   * LedgerService.assertPeriodOpen looks for a lock on the first of the entry
   * month, so every lock must be stored normalised — a lock saved on the 15th
   * would silently never match.
   */
  private firstOfMonth(date: string): Date {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`"${date}" is not a valid date`);
    }
    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1));
  }

  private toLockDto(row: {
    id: number;
    month: Date;
    lockedAt: Date;
    lockedBy: number | null;
    note: string | null;
  }): PeriodLockDto {
    return {
      id: row.id,
      month: row.month.toISOString().slice(0, 7),
      lockedAt: row.lockedAt,
      lockedBy: row.lockedBy,
      note: row.note,
    };
  }

  async listPeriodLocks(): Promise<PeriodLockDto[]> {
    const rows = await this.prisma.client.periodLock.findMany({ orderBy: { month: 'desc' } });
    return rows.map((row) => this.toLockDto(row));
  }

  async lockPeriod(month: string, adminId: number, note?: string): Promise<PeriodLockDto> {
    const normalised = this.firstOfMonth(month);
    const existing = await this.prisma.client.periodLock.findFirst({ where: { month: normalised } });
    if (existing) {
      throw new BadRequestException(
        `${normalised.toISOString().slice(0, 7)} is already locked`,
      );
    }
    const row = await this.prisma.client.periodLock.create({
      data: { month: normalised, lockedBy: adminId, note: note ?? null },
    });
    return this.toLockDto(row);
  }

  async unlockPeriod(month: string): Promise<{ month: string }> {
    const normalised = this.firstOfMonth(month);
    await this.prisma.client.periodLock.deleteMany({ where: { month: normalised } });
    return { month: normalised.toISOString().slice(0, 7) };
  }
}
