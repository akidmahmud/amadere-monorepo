import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DueKind, LedgerDirection, LedgerSource, Prisma } from '@amader/db';
import { PrismaService } from '../../../../common/prisma/prisma.service';

const Decimal = Prisma.Decimal;
const ZERO = new Decimal(0);

export interface PostLedgerInput {
  entryDate: Date;
  direction: LedgerDirection;
  /** Always positive — direction carries the sign. */
  amount: Prisma.Decimal;
  accountId: number;
  partyId?: number | null;
  source: LedgerSource;
  expenseId?: number | null;
  dueId?: number | null;
  orderId?: number | null;
  reference?: string | null;
  note?: string | null;
}

export interface PartyPosition {
  receivable: Prisma.Decimal;
  payable: Prisma.Decimal;
  net: Prisma.Decimal;
}

// Any Prisma client: the real one, or a transaction handle. Callers pass a
// transaction when a document and its payment must land together.
type Db = PrismaService['client'];

/**
 * The only code permitted to insert a LedgerEntry.
 *
 * Everything the Accounts module reports about money — account balances, how
 * much of a due has been paid, a party's net position — is derived from these
 * rows. That is deliberate: the previous design stored a cumulative
 * `paidAmount` alongside the movements, and cash-flow reporting re-read that
 * running total once per period the row was touched, so a due paid in three
 * instalments was counted three times. Derived figures cannot drift from
 * their own evidence.
 *
 * If anything else ever inserts into ledger_entries, that guarantee is gone.
 */
@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Prisma.TransactionClient): Db {
    return (tx ?? this.prisma.client) as Db;
  }

  /** Throws if `date` falls inside a closed accounting period. */
  async assertPeriodOpen(date: Date, tx?: Prisma.TransactionClient): Promise<void> {
    const month = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    const lock = await this.db(tx).periodLock.findFirst({ where: { month } });
    if (lock) {
      throw new BadRequestException(
        `Accounting period ${month.toISOString().slice(0, 7)} is locked. Unlock it before posting.`,
      );
    }
  }

  async post(input: PostLedgerInput, adminId: number | null, tx?: Prisma.TransactionClient) {
    // Direction carries the sign. Storing a negative amount as well would
    // make every SUM depend on which convention the writer happened to use.
    if (input.amount.lessThanOrEqualTo(ZERO)) {
      throw new BadRequestException('Ledger amount must be greater than zero');
    }
    await this.assertPeriodOpen(input.entryDate, tx);

    return this.db(tx).ledgerEntry.create({
      data: {
        entryDate: input.entryDate,
        direction: input.direction,
        amount: input.amount,
        accountId: input.accountId,
        partyId: input.partyId ?? null,
        source: input.source,
        expenseId: input.expenseId ?? null,
        dueId: input.dueId ?? null,
        orderId: input.orderId ?? null,
        reference: input.reference ?? null,
        note: input.note ?? null,
        createdBy: adminId,
      },
    });
  }

  /**
   * Books the opposite entry. Never deletes: a voucher whose ledger rows have
   * vanished cannot be reconciled against a bank statement.
   */
  async reverse(entryId: number, adminId: number | null, tx?: Prisma.TransactionClient) {
    const db = this.db(tx);
    const original = await db.ledgerEntry.findUnique({ where: { id: entryId } });
    if (!original) throw new NotFoundException(`Ledger entry ${entryId} not found`);
    if (original.reversalOfId) {
      throw new BadRequestException(
        'That entry is already a reversal; reverse the original instead',
      );
    }

    return db.ledgerEntry.create({
      data: {
        entryDate: original.entryDate,
        direction: original.direction === 'IN' ? 'OUT' : 'IN',
        amount: original.amount,
        accountId: original.accountId,
        partyId: original.partyId,
        source: original.source,
        expenseId: original.expenseId,
        dueId: original.dueId,
        orderId: original.orderId,
        reversalOfId: original.id,
        note: `Reversal of entry #${original.id}`,
        createdBy: adminId,
      },
    });
  }

  /** openingBalance + sum(IN) - sum(OUT). Never read from a stored column. */
  async accountBalance(accountId: number, asOf?: Date): Promise<Prisma.Decimal> {
    const account = await this.prisma.client.cashAccount.findUnique({ where: { id: accountId } });
    if (!account) throw new NotFoundException(`Cash account ${accountId} not found`);

    const where = { accountId, ...(asOf ? { entryDate: { lte: asOf } } : {}) };
    const [inSum, outSum] = await Promise.all([
      this.prisma.client.ledgerEntry.aggregate({
        where: { ...where, direction: 'IN' },
        _sum: { amount: true },
      }),
      this.prisma.client.ledgerEntry.aggregate({
        where: { ...where, direction: 'OUT' },
        _sum: { amount: true },
      }),
    ]);

    return account.openingBalance
      .plus(inSum._sum.amount ?? ZERO)
      .minus(outSum._sum.amount ?? ZERO);
  }

  /**
   * How much has been settled on each of many dues, in ONE query.
   *
   * Every list screen needs this for a whole page of rows. Asking per row
   * turned a 200-row party list into thousands of round trips; the figures
   * were right, the query count was not.
   *
   * Callers pass the dues they already loaded, so this never re-reads them.
   */
  async paidForDues(
    dues: { id: number; kind: DueKind }[],
    tx?: Prisma.TransactionClient,
  ): Promise<Map<number, Prisma.Decimal>> {
    const paid = new Map<number, Prisma.Decimal>(dues.map((d) => [d.id, ZERO]));
    if (dues.length === 0) return paid;

    const grouped = await this.db(tx).ledgerEntry.groupBy({
      by: ['dueId', 'direction'],
      where: { dueId: { in: dues.map((d) => d.id) } },
      _sum: { amount: true },
    });

    const kindById = new Map(dues.map((d) => [d.id, d.kind]));
    for (const row of grouped) {
      if (row.dueId === null) continue;
      // Receiving on a receivable is money IN; paying a payable is money OUT.
      // The opposite direction is a reversal and nets back out.
      const settling: LedgerDirection = kindById.get(row.dueId) === 'PAYABLE' ? 'OUT' : 'IN';
      const amount = row._sum.amount ?? ZERO;
      const current = paid.get(row.dueId) ?? ZERO;
      paid.set(row.dueId, row.direction === settling ? current.plus(amount) : current.minus(amount));
    }
    return paid;
  }

  async paidForDue(dueId: number, tx?: Prisma.TransactionClient): Promise<Prisma.Decimal> {
    const db = this.db(tx);
    const due = await db.due.findUnique({ where: { id: dueId }, select: { kind: true } });
    if (!due) throw new NotFoundException(`Due ${dueId} not found`);
    const paid = await this.paidForDues([{ id: dueId, kind: due.kind }], tx);
    return paid.get(dueId) ?? ZERO;
  }

  /** Same batching for expense vouchers. */
  async paidForExpenses(
    expenseIds: number[],
    tx?: Prisma.TransactionClient,
  ): Promise<Map<number, Prisma.Decimal>> {
    const paid = new Map<number, Prisma.Decimal>(expenseIds.map((id) => [id, ZERO]));
    if (expenseIds.length === 0) return paid;

    const grouped = await this.db(tx).ledgerEntry.groupBy({
      by: ['expenseId', 'direction'],
      where: { expenseId: { in: expenseIds } },
      _sum: { amount: true },
    });

    for (const row of grouped) {
      if (row.expenseId === null) continue;
      const amount = row._sum.amount ?? ZERO;
      const current = paid.get(row.expenseId) ?? ZERO;
      paid.set(row.expenseId, row.direction === 'OUT' ? current.plus(amount) : current.minus(amount));
    }
    return paid;
  }

  async paidForExpense(expenseId: number, tx?: Prisma.TransactionClient): Promise<Prisma.Decimal> {
    const paid = await this.paidForExpenses([expenseId], tx);
    return paid.get(expenseId) ?? ZERO;
  }

  /**
   * Positions for many parties in two queries: their open dues, then one
   * grouped sum across all of them.
   */
  async partyPositions(partyIds: number[]): Promise<Map<number, PartyPosition>> {
    const positions = new Map<number, PartyPosition>(
      partyIds.map((id) => [id, { receivable: ZERO, payable: ZERO, net: ZERO }]),
    );
    if (partyIds.length === 0) return positions;

    const dues = await this.prisma.client.due.findMany({
      where: { partyId: { in: partyIds }, voidedAt: null },
      select: { id: true, kind: true, amount: true, partyId: true },
    });
    const paid = await this.paidForDues(dues);

    for (const due of dues) {
      const outstanding = due.amount.minus(paid.get(due.id) ?? ZERO);
      // A settled due is not a position — only what is still owed counts.
      if (outstanding.lessThanOrEqualTo(ZERO)) continue;
      const position = positions.get(due.partyId);
      if (!position) continue;
      if (due.kind === 'RECEIVABLE') position.receivable = position.receivable.plus(outstanding);
      else position.payable = position.payable.plus(outstanding);
    }

    for (const position of positions.values()) {
      position.net = position.receivable.minus(position.payable);
    }
    return positions;
  }

  /**
   * What a party owes us, what we owe them, and the net.
   *
   * The whole reason parties are one table: a courier holds our COD cash
   * (receivable) and invoices us for delivery (payable) at the same time.
   * With two free-text name fields this figure would not exist.
   */
  async partyPosition(partyId: number): Promise<PartyPosition> {
    const positions = await this.partyPositions([partyId]);
    return positions.get(partyId) ?? { receivable: ZERO, payable: ZERO, net: ZERO };
  }

  /**
   * Closing balance for every active account, in two queries rather than two
   * per account.
   */
  async accountBalances(asOf?: Date): Promise<Map<number, Prisma.Decimal>> {
    const accounts = await this.prisma.client.cashAccount.findMany({
      select: { id: true, openingBalance: true },
    });
    const balances = new Map<number, Prisma.Decimal>(
      accounts.map((a) => [a.id, a.openingBalance]),
    );

    const grouped = await this.prisma.client.ledgerEntry.groupBy({
      by: ['accountId', 'direction'],
      where: asOf ? { entryDate: { lte: asOf } } : {},
      _sum: { amount: true },
    });

    for (const row of grouped) {
      const current = balances.get(row.accountId);
      if (!current) continue;
      const amount = row._sum.amount ?? ZERO;
      balances.set(
        row.accountId,
        row.direction === 'IN' ? current.plus(amount) : current.minus(amount),
      );
    }
    return balances;
  }
}
