import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ExpensesService } from '../net-profit/accounts/expenses/expenses.service';

/**
 * Store expenses from the POS (rent, electricity, staff tea…). Booked as a
 * normal Accounts expense — same voucher, ledger and VAT rules — against the
 * store's cost centre and paid from the store's own cash / card / mobile
 * account, so Store profit picks it up. Staff need only pos.expenses, not
 * the Accounts permissions.
 */
@Injectable()
export class PosExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expenses: ExpensesService,
  ) {}

  /**
   * The store, with a cost centre: stores made before cost centres existed
   * (e.g. the online Main Store) get one on their first expense, named like
   * the ones Admin › Stores creates.
   */
  private async store(storeId: number) {
    const s = await this.prisma.client.store.findUniqueOrThrow({
      where: { id: storeId },
    });
    if (s.costCentreId) return { ...s, costCentreId: s.costCentreId };
    return this.prisma.client.$transaction(async (tx) => {
      const cc =
        (await tx.costCentre.findFirst({ where: { code: s.code } })) ??
        (await tx.costCentre.create({
          data: { name: `Store: ${s.name}`, code: s.code },
        }));
      await tx.store.update({
        where: { id: s.id },
        data: { costCentreId: cc.id },
      });
      return { ...s, costCentreId: cc.id };
    });
  }

  /**
   * Accounts an expense may be paid from: the store's own cash / card /
   * mobile accounts, or — when none is set — every active money account.
   */
  private async payableAccounts(storeId: number) {
    const s = await this.prisma.client.store.findUniqueOrThrow({
      where: { id: storeId },
    });
    const own = (
      [
        ['Cash', s.cashAccountId],
        ['Card', s.cardAccountId],
        ['Mobile Banking', s.mobileAccountId],
      ] as const
    ).filter(([, id]) => id !== null) as [string, number][];
    const rows = await this.prisma.client.cashAccount.findMany({
      where: own.length
        ? { id: { in: own.map(([, id]) => id) } }
        : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true },
    });
    return own.length
      ? own.flatMap(([kind, id]) => {
          const r = rows.find((x) => x.id === id);
          return r ? [{ id, label: `${kind} — ${r.name}` }] : [];
        })
      : rows.map((r) => ({ id: r.id, label: r.name }));
  }

  /** Categories and the accounts an expense can be paid from. */
  async options(storeId: number) {
    const [categories, accounts] = await Promise.all([
      this.prisma.client.expenseCategory.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true },
      }),
      this.payableAccounts(storeId),
    ]);
    return { categories, accounts };
  }

  /** This store's expenses in [from, to] (calendar days). */
  async list(storeId: number, from: string, to: string) {
    const s = await this.store(storeId);
    const rows = await this.prisma.client.expense.findMany({
      where: {
        costCentreId: s.costCentreId,
        voidedAt: null,
        expenseDate: {
          gte: new Date(`${from}T00:00:00Z`),
          lte: new Date(`${to}T00:00:00Z`),
        },
      },
      orderBy: [{ expenseDate: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        voucherNo: true,
        expenseDate: true,
        grossAmount: true,
        note: true,
        category: { select: { name: true } },
        party: { select: { name: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      voucherNo: r.voucherNo,
      date: r.expenseDate.toISOString().slice(0, 10),
      category: r.category.name,
      paidTo: r.party.name,
      amount: r.grossAmount.toFixed(2),
      note: r.note,
    }));
  }

  async create(
    storeId: number,
    input: {
      date: string;
      categoryId: number;
      amount: number;
      accountId: number;
      paidTo?: string;
      note?: string;
    },
    adminId: number,
  ) {
    const s = await this.store(storeId);
    if (!(await this.payableAccounts(storeId)).some((x) => x.id === input.accountId))
      throw new BadRequestException('Pick an account this store can pay from');
    const partyId = await this.payee(
      input.paidTo?.trim() || `${s.name} — store expenses`,
      adminId,
    );
    return this.expenses.create(
      {
        expenseDate: input.date,
        categoryId: input.categoryId,
        costCentreId: s.costCentreId,
        partyId,
        amount: input.amount.toFixed(2),
        paymentStatus: 'paid',
        paidNow: input.amount.toFixed(2),
        paidFromAccountId: input.accountId,
        note: input.note?.trim() || undefined,
      },
      adminId,
    );
  }

  /** The person / shop paid, by name; created on first use. */
  private async payee(name: string, adminId: number): Promise<number> {
    const found = await this.prisma.client.party.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, isActive: true },
      select: { id: true },
    });
    if (found) return found.id;
    const created = await this.prisma.client.party.create({
      data: {
        name,
        type: 'PERSON',
        roles: ['OTHER'],
        note: `Added from the POS by admin #${adminId}`,
      },
    });
    return created.id;
  }
}
