import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentProvider } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { PermissionCheck } from '../../common/auth/permission.decorator';
import { resolveStoreScope } from './store-scope';
import { UpsertStoreDto } from './dto/store.dto';

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  async adminStoreId(adminUserId: number): Promise<number | null> {
    const a = await this.prisma.client.adminUser.findUniqueOrThrow({
      where: { id: adminUserId },
      select: { storeId: true },
    });
    return a.storeId;
  }

  async scope(
    adminUserId: number,
    can: PermissionCheck,
    requested?: number,
  ): Promise<number | null> {
    return resolveStoreScope(
      { storeId: await this.adminStoreId(adminUserId) },
      can,
      requested,
    );
  }

  /** Every POS user needs the store list; only managers see who works where. */
  async list(canSeeStaff: boolean) {
    const rows = await this.prisma.client.store.findMany({
      orderBy: [{ isOnlineStore: 'desc' }, { name: 'asc' }],
      include: {
        staff: {
          where: { deletedAt: null },
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
    return rows.map((s) => ({
      ...s,
      staffCount: s.staff.length,
      staff: canSeeStaff ? s.staff : [],
    }));
  }

  // Each store gets its own cost centre so Accounts can split expenses by store.
  create(dto: UpsertStoreDto) {
    return this.prisma.client.$transaction(async (tx) => {
      const cc = await tx.costCentre.create({
        data: { name: `Store: ${dto.name}`, code: dto.code },
      });
      return tx.store.create({ data: { ...dto, costCentreId: cc.id } });
    });
  }

  update(id: number, dto: UpsertStoreDto) {
    return this.prisma.client.store.update({ where: { id }, data: dto });
  }

  /**
   * Deletes a store that has no history. Once it has sales, stock movements,
   * transfers, its own products or expenses, deleting would orphan money and
   * stock records, so the caller is told to deactivate it instead.
   */
  async remove(id: number): Promise<void> {
    const c = this.prisma.client;
    const s = await c.store.findUniqueOrThrow({ where: { id } });
    if (s.isOnlineStore)
      throw new BadRequestException(
        'The online store holds the website stock and cannot be deleted.',
      );
    const [orders, movements, stockIns, transfers, products, expenses] =
      await Promise.all([
        c.order.count({ where: { storeId: id } }),
        c.stockMovement.count({ where: { storeId: id } }),
        c.stockIn.count({ where: { storeId: id } }),
        c.stockTransfer.count({
          where: { OR: [{ fromStoreId: id }, { toStoreId: id }] },
        }),
        c.product.count({ where: { storeId: id } }),
        s.costCentreId
          ? c.expense.count({ where: { costCentreId: s.costCentreId } })
          : 0,
      ]);
    const used = [
      orders && `${orders} sale(s)`,
      movements && `${movements} stock movement(s)`,
      stockIns && `${stockIns} stock-in(s)`,
      transfers && `${transfers} transfer(s)`,
      products && `${products} store-only product(s)`,
      expenses && `${expenses} expense(s)`,
    ].filter(Boolean);
    if (used.length)
      throw new BadRequestException(
        `This store has ${used.join(', ')}. Untick "Active" instead to hide it from the POS.`,
      );
    // Staff are unassigned (SetNull); coupons, held sales and the invoice
    // template go with the store (Cascade).
    await c.$transaction(async (tx) => {
      await tx.store.delete({ where: { id } });
      if (s.costCentreId)
        await tx.costCentre.delete({ where: { id: s.costCentreId } });
    });
  }

  /** Makes exactly these admins the store's staff (others lose it). */
  async assignStaff(storeId: number, adminUserIds: number[]): Promise<void> {
    await this.prisma.client.$transaction([
      this.prisma.client.adminUser.updateMany({
        where: { storeId, id: { notIn: adminUserIds } },
        data: { storeId: null },
      }),
      this.prisma.client.adminUser.updateMany({
        where: { id: { in: adminUserIds } },
        data: { storeId },
      }),
    ]);
  }

  /** The store's account for a tender; undefined = fall back to the Accounts default. */
  async tenderAccountId(
    storeId: number,
    provider: PaymentProvider,
  ): Promise<number | undefined> {
    const s = await this.prisma.client.store.findUniqueOrThrow({
      where: { id: storeId },
    });
    const id =
      provider === 'CASH'
        ? s.cashAccountId
        : provider === 'CARD'
          ? s.cardAccountId
          : s.mobileAccountId;
    return id ?? undefined;
  }
}
