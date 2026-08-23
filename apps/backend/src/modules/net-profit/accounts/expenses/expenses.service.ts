import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { PaginatedResult, computeExpenseAmounts, fromPaisa, toPaisa } from '@amader/shared';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { paginationArgs, toPaginatedResult } from '../../../../common/pagination.util';
import { LedgerService } from '../ledger/ledger.service';
import { DuesService } from '../dues/dues.service';
import { nextDueDocNo, nextVoucherNo } from '../document-numbers';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpenseQueryDto } from './dto/expense-query.dto';
import { RecordExpensePaymentDto } from './dto/record-expense-payment.dto';

const Decimal = Prisma.Decimal;
const ZERO = new Decimal(0);

export type ExpensePaymentStatus = 'PAID' | 'PARTIAL' | 'UNPAID';

export interface ExpenseDto {
  id: number;
  voucherNo: string;
  expenseDate: Date;
  categoryId: number;
  categoryName: string;
  costCentreId: number | null;
  costCentreName: string | null;
  partyId: number;
  partyName: string;
  netAmount: string;
  vatRate: string;
  vatAmount: string;
  grossAmount: string;
  amountIncludesVat: boolean;
  mushakChallanNo: string | null;
  aitAmount: string;
  vdsAmount: string;
  netPayable: string;
  /** Derived from the ledger — there is no stored paid column. */
  paidAmount: string;
  remaining: string;
  paymentStatus: ExpensePaymentStatus;
  dueDate: Date | null;
  attachmentUrl: string | null;
  note: string | null;
  voidedAt: Date | null;
}

/** Percent string ("15", "7.5") to basis points (1500, 750). */
function toBasisPoints(percent: string | number | undefined): number {
  if (percent === undefined || percent === null || percent === '') return 0;
  const n = Number(percent);
  if (!Number.isFinite(n)) throw new BadRequestException(`"${percent}" is not a valid percentage`);
  return Math.round(n * 100);
}

function paisaOrThrow(value: string, field: string): number {
  try {
    return toPaisa(value);
  } catch {
    throw new BadRequestException(`${field} must be a number`);
  }
}

type ExpenseRow = Prisma.ExpenseGetPayload<{
  include: { category: true; party: true; costCentre: true };
}>;

/**
 * Expense vouchers.
 *
 * Two rules from the design carry the weight here:
 *   1. The VAT/withholding split comes from computeExpenseAmounts() in
 *      @amader/shared — the same function the admin form's calc strip calls,
 *      so the figure shown can never differ from the figure saved.
 *   2. An unpaid or partly paid expense generates its own payable. That is
 *      what makes "bills go in through Expenses" true, and it means there is
 *      one payment path rather than two.
 */
@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly dues: DuesService,
  ) {}

  private toDto(row: ExpenseRow, paid: Prisma.Decimal): ExpenseDto {
    const remaining = row.netPayable.minus(paid);
    const paymentStatus: ExpensePaymentStatus = remaining.lessThanOrEqualTo(ZERO)
      ? 'PAID'
      : paid.greaterThan(ZERO)
        ? 'PARTIAL'
        : 'UNPAID';

    return {
      id: row.id,
      voucherNo: row.voucherNo,
      expenseDate: row.expenseDate,
      categoryId: row.categoryId,
      categoryName: row.category?.name ?? '',
      costCentreId: row.costCentreId,
      costCentreName: row.costCentre?.name ?? null,
      partyId: row.partyId,
      partyName: row.party?.name ?? '',
      netAmount: row.netAmount.toFixed(2),
      vatRate: row.vatRate.toFixed(2),
      vatAmount: row.vatAmount.toFixed(2),
      grossAmount: row.grossAmount.toFixed(2),
      amountIncludesVat: row.amountIncludesVat,
      mushakChallanNo: row.mushakChallanNo,
      aitAmount: row.aitAmount.toFixed(2),
      vdsAmount: row.vdsAmount.toFixed(2),
      netPayable: row.netPayable.toFixed(2),
      paidAmount: paid.toFixed(2),
      remaining: remaining.lessThan(ZERO) ? '0.00' : remaining.toFixed(2),
      paymentStatus,
      dueDate: row.dueDate,
      attachmentUrl: row.attachmentUrl,
      note: row.note,
      voidedAt: row.voidedAt,
    };
  }

  async findOne(id: number): Promise<ExpenseDto> {
    const row = await this.prisma.client.expense.findUnique({
      where: { id },
      include: { category: true, party: true, costCentre: true },
    });
    if (!row) throw new NotFoundException(`Expense ${id} not found`);
    return this.toDto(row, await this.ledger.paidForExpense(id));
  }

  /**
   * Ids matching a derived payment status. Status is a function of the ledger,
   * so there is no column to index — this is a grouped sum. Add a generated
   * column if it ever becomes slow.
   */
  private async idsWithStatus(status: ExpensePaymentStatus): Promise<number[]> {
    const paidExpr = Prisma.sql`COALESCE(SUM(CASE WHEN l.direction = 'OUT' THEN l.amount ELSE -l.amount END), 0)`;
    const having =
      status === 'PAID'
        ? Prisma.sql`${paidExpr} >= e.net_payable`
        : status === 'UNPAID'
          ? Prisma.sql`${paidExpr} <= 0`
          : Prisma.sql`${paidExpr} > 0 AND ${paidExpr} < e.net_payable`;

    const rows = await this.prisma.client.$queryRaw<{ id: number }[]>`
      SELECT e.id
      FROM expenses e
      LEFT JOIN ledger_entries l ON l.expense_id = e.id
      GROUP BY e.id, e.net_payable
      HAVING ${having}
    `;
    return rows.map((r) => r.id);
  }

  async list(query: ExpenseQueryDto): Promise<PaginatedResult<ExpenseDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.ExpenseWhereInput = {
      voidedAt: query.includeVoided ? undefined : null,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.costCentreId ? { costCentreId: query.costCentreId } : {}),
      ...(query.partyId ? { partyId: query.partyId } : {}),
      ...(query.from || query.to
        ? {
            expenseDate: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.q
        ? {
            OR: [
              { voucherNo: { contains: query.q, mode: 'insensitive' as const } },
              { note: { contains: query.q, mode: 'insensitive' as const } },
              { party: { name: { contains: query.q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    if (query.paymentStatus) {
      where.id = { in: await this.idsWithStatus(query.paymentStatus) };
    }

    const [rows, total] = await Promise.all([
      this.prisma.client.expense.findMany({
        where,
        include: { category: true, party: true, costCentre: true },
        orderBy: [{ expenseDate: 'desc' }, { id: 'desc' }],
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.expense.count({ where }),
    ]);

    // One grouped sum for the page rather than one query per voucher.
    const paid = await this.ledger.paidForExpenses(rows.map((r) => r.id));
    const items = rows.map((row) => this.toDto(row, paid.get(row.id) ?? ZERO));
    return toPaginatedResult(items, total, page, pageSize);
  }

  /** How much of the bill is being settled right now. */
  private resolvePaidNow(dto: CreateExpenseDto, netPayable: Prisma.Decimal): Prisma.Decimal {
    switch (dto.paymentStatus) {
      case 'paid':
        return netPayable;
      case 'due':
        return ZERO;
      case 'partial': {
        const paid = new Decimal(dto.paidNow ?? 0);
        if (paid.lessThanOrEqualTo(ZERO) || paid.greaterThanOrEqualTo(netPayable)) {
          throw new BadRequestException(
            'A partial payment must be more than zero and less than the net payable',
          );
        }
        return paid;
      }
      default:
        throw new BadRequestException(`Unknown payment status: ${String(dto.paymentStatus)}`);
    }
  }

  async create(dto: CreateExpenseDto, adminId: number): Promise<ExpenseDto> {
    const expenseDate = new Date(dto.expenseDate);
    await this.ledger.assertPeriodOpen(expenseDate);

    // One implementation of the money math, shared with the browser calc
    // strip. Never recompute it here.
    const amounts = computeExpenseAmounts({
      amount: paisaOrThrow(dto.amount, 'amount'),
      amountIncludesVat: dto.amountIncludesVat ?? false,
      vatRate: toBasisPoints(dto.vatRate),
      aitPercent: toBasisPoints(dto.aitPercent),
      vdsPercent: toBasisPoints(dto.vdsPercent),
    });
    const netPayable = new Decimal(fromPaisa(amounts.netPayable));

    const paidNow = this.resolvePaidNow(dto, netPayable);
    if (paidNow.greaterThan(ZERO) && !dto.paidFromAccountId) {
      throw new BadRequestException('Choose the account the money was paid from');
    }
    const remainder = netPayable.minus(paidNow);

    const created = await this.prisma.client.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          voucherNo: await nextVoucherNo(tx as never, expenseDate),
          expenseDate,
          categoryId: dto.categoryId,
          costCentreId: dto.costCentreId ?? null,
          partyId: dto.partyId,
          netAmount: new Decimal(fromPaisa(amounts.netAmount)),
          vatRate: new Decimal(dto.vatRate ?? 0),
          vatAmount: new Decimal(fromPaisa(amounts.vatAmount)),
          grossAmount: new Decimal(fromPaisa(amounts.grossAmount)),
          amountIncludesVat: dto.amountIncludesVat ?? false,
          mushakChallanNo: dto.mushakChallanNo ?? null,
          aitPercent: new Decimal(dto.aitPercent ?? 0),
          aitAmount: new Decimal(fromPaisa(amounts.aitAmount)),
          vdsPercent: new Decimal(dto.vdsPercent ?? 0),
          vdsAmount: new Decimal(fromPaisa(amounts.vdsAmount)),
          netPayable,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          attachmentUrl: dto.attachmentUrl ?? null,
          note: dto.note ?? null,
          createdBy: adminId,
        },
      });

      if (paidNow.greaterThan(ZERO)) {
        await this.ledger.post(
          {
            entryDate: expenseDate,
            direction: 'OUT',
            amount: paidNow,
            accountId: dto.paidFromAccountId!,
            partyId: dto.partyId,
            source: 'EXPENSE_PAYMENT',
            expenseId: expense.id,
            note: `Voucher ${expense.voucherNo}`,
          },
          adminId,
          tx,
        );
      }

      // The payable is generated, never retyped — that is what "bills go in
      // through Expenses" means in practice.
      if (remainder.greaterThan(ZERO)) {
        await tx.due.create({
          data: {
            docNo: await nextDueDocNo(tx as never, 'PAYABLE', expenseDate),
            kind: 'PAYABLE',
            source: 'EXPENSE',
            expenseId: expense.id,
            partyId: dto.partyId,
            amount: remainder,
            issueDate: expenseDate,
            dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
            note: `Voucher ${expense.voucherNo}`,
            createdBy: adminId,
          },
        });
      }

      return expense;
    });

    return this.findOne(created.id);
  }

  /**
   * Edits the descriptive fields only. Amounts are deliberately not editable:
   * changing them after payments have been posted would leave the voucher and
   * the ledger disagreeing. Void and re-enter instead.
   */
  async update(id: number, dto: UpdateExpenseDto): Promise<ExpenseDto> {
    const existing = await this.prisma.client.expense.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Expense ${id} not found`);
    if (existing.voidedAt) throw new BadRequestException('That expense is voided');

    await this.prisma.client.expense.update({
      where: { id },
      data: {
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.costCentreId !== undefined ? { costCentreId: dto.costCentreId } : {}),
        ...(dto.mushakChallanNo !== undefined ? { mushakChallanNo: dto.mushakChallanNo } : {}),
        ...(dto.dueDate !== undefined ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null } : {}),
        ...(dto.attachmentUrl !== undefined ? { attachmentUrl: dto.attachmentUrl } : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
      },
    });
    return this.findOne(id);
  }

  /**
   * Voids the voucher: reverses its ledger entries and voids the payable it
   * generated. Never deletes — a voucher whose rows have vanished cannot be
   * reconciled against a bank statement.
   */
  async void(id: number, adminId: number): Promise<ExpenseDto> {
    const expense = await this.prisma.client.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException(`Expense ${id} not found`);
    if (expense.voidedAt) throw new BadRequestException('That expense is already voided');
    await this.ledger.assertPeriodOpen(expense.expenseDate);

    // Payments made at save time carry expenseId; instalments paid later
    // against the generated payable carry dueId instead. Both have to be
    // reversed, or voiding a partly paid bill leaves the document cancelled
    // while the cash stays gone.
    const linkedDues = await this.prisma.client.due.findMany({
      where: { expenseId: id, voidedAt: null },
      select: { id: true },
    });
    const entries = await this.prisma.client.ledgerEntry.findMany({
      where: {
        reversalOfId: null,
        OR: [
          { expenseId: id },
          ...(linkedDues.length ? [{ dueId: { in: linkedDues.map((d) => d.id) } }] : []),
        ],
      },
      select: { id: true },
    });

    await this.prisma.client.$transaction(async (tx) => {
      for (const entry of entries) {
        await this.ledger.reverse(entry.id, adminId, tx);
      }
      await tx.due.updateMany({
        where: { expenseId: id, voidedAt: null },
        data: { voidedAt: new Date() },
      });
      await tx.expense.update({ where: { id }, data: { voidedAt: new Date() } });
    });

    return this.findOne(id);
  }

  /**
   * Convenience for the expense register's pay button. Delegates to the
   * generated payable so every payment still goes through one path.
   */
  async recordPayment(
    id: number,
    dto: RecordExpensePaymentDto,
    adminId: number,
  ): Promise<ExpenseDto> {
    const payable = await this.prisma.client.due.findFirst({
      where: { expenseId: id, kind: 'PAYABLE', voidedAt: null },
      select: { id: true },
    });
    if (!payable) {
      throw new BadRequestException('That expense has no outstanding payable to pay');
    }
    await this.dues.recordPayment(payable.id, dto, adminId);
    return this.findOne(id);
  }
}
