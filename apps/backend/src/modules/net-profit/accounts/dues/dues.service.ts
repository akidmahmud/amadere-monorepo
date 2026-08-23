import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DueKind, Prisma } from '@amader/db';
import { AgeingBucket, PaginatedResult, ageingBucket } from '@amader/shared';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { paginationArgs, toPaginatedResult } from '../../../../common/pagination.util';
import { LedgerService } from '../ledger/ledger.service';
import { nextDueDocNo } from '../document-numbers';
import { CreateDueDto } from './dto/create-due.dto';
import { DueQueryDto } from './dto/due-query.dto';
import { RecordDuePaymentDto } from './dto/record-due-payment.dto';

const Decimal = Prisma.Decimal;
const ZERO = new Decimal(0);
const DAY_MS = 86_400_000;

export type DueStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID';

export interface DueDto {
  id: number;
  docNo: string;
  kind: string;
  partyId: number;
  partyName: string;
  source: string;
  amount: string;
  /** Derived from the ledger — there is no stored paidAmount column. */
  paidAmount: string;
  remaining: string;
  status: DueStatus;
  issueDate: Date;
  dueDate: Date | null;
  ageDays: number;
  bucket: AgeingBucket;
  expenseId: number | null;
  orderId: number | null;
  note: string | null;
  voidedAt: Date | null;
}

export interface AgeingReport {
  kind: string;
  buckets: Record<AgeingBucket, { count: number; amount: string }>;
  total: string;
  overdue: string;
  averageAgeDays: number;
}

function decimalOrThrow(value: string, field: string): Prisma.Decimal {
  try {
    return new Decimal(value);
  } catch {
    throw new BadRequestException(`${field} must be a number`);
  }
}

function overdueDays(dueDate: Date | null, asOf: Date): number {
  if (!dueDate) return 0;
  return Math.max(0, Math.floor((asOf.getTime() - dueDate.getTime()) / DAY_MS));
}

/**
 * Receivables and payables.
 *
 * There is no stored `paidAmount` or `status`: both are derived from the
 * ledger entries carrying this due's id. Keeping a running total beside the
 * movements is what let cash-flow reporting count a three-instalment due three
 * times.
 */
@Injectable()
export class DuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  private toDto(
    row: Prisma.DueGetPayload<{ include: { party: true } }> | Prisma.DueGetPayload<Record<string, never>>,
    asOf: Date,
    paid: Prisma.Decimal,
    partyName?: string,
  ): DueDto {
    const remaining = row.amount.minus(paid);
    const status: DueStatus = remaining.lessThanOrEqualTo(ZERO)
      ? 'PAID'
      : paid.greaterThan(ZERO)
        ? 'PARTIALLY_PAID'
        : 'PENDING';

    const name =
      partyName ??
      ('party' in row && row.party ? (row.party as { name: string }).name : '');

    return {
      id: row.id,
      docNo: row.docNo,
      kind: row.kind,
      partyId: row.partyId,
      partyName: name,
      source: row.source,
      amount: row.amount.toFixed(2),
      paidAmount: paid.toFixed(2),
      remaining: remaining.lessThan(ZERO) ? '0.00' : remaining.toFixed(2),
      status,
      issueDate: row.issueDate,
      dueDate: row.dueDate,
      ageDays: overdueDays(row.dueDate, asOf),
      bucket: ageingBucket(row.dueDate, asOf),
      expenseId: row.expenseId,
      orderId: row.orderId,
      note: row.note,
      voidedAt: row.voidedAt,
    };
  }

  async findOne(id: number, asOf = new Date()): Promise<DueDto> {
    const row = await this.prisma.client.due.findUnique({
      where: { id },
      include: { party: true },
    });
    if (!row) throw new NotFoundException(`Due ${id} not found`);
    return this.toDto(row, asOf, await this.ledger.paidForDue(id));
  }

  /**
   * Ids matching a derived status. Status has no column to index — it is a
   * function of the ledger — so this is a grouped sum. If it becomes slow at
   * volume, add a generated column then.
   */
  private async idsWithStatus(status: DueStatus): Promise<number[]> {
    const having =
      status === 'PAID'
        ? Prisma.sql`>= d.amount`
        : status === 'PENDING'
          ? Prisma.sql`<= 0`
          : Prisma.sql`> 0 AND COALESCE(SUM(CASE WHEN l.direction = (CASE WHEN d.kind = 'PAYABLE' THEN 'OUT' ELSE 'IN' END)::"LedgerDirection" THEN l.amount ELSE -l.amount END), 0) < d.amount`;

    const rows = await this.prisma.client.$queryRaw<{ id: number }[]>`
      SELECT d.id
      FROM dues d
      LEFT JOIN ledger_entries l ON l.due_id = d.id
      GROUP BY d.id, d.amount, d.kind
      HAVING COALESCE(SUM(CASE WHEN l.direction = (CASE WHEN d.kind = 'PAYABLE' THEN 'OUT' ELSE 'IN' END)::"LedgerDirection" THEN l.amount ELSE -l.amount END), 0) ${having}
    `;
    return rows.map((r) => r.id);
  }

  async list(query: DueQueryDto): Promise<PaginatedResult<DueDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const asOf = new Date();

    const where: Prisma.DueWhereInput = {
      voidedAt: null,
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.partyId ? { partyId: query.partyId } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.from || query.to
        ? {
            issueDate: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.q
        ? {
            OR: [
              { docNo: { contains: query.q, mode: 'insensitive' as const } },
              { note: { contains: query.q, mode: 'insensitive' as const } },
              { party: { name: { contains: query.q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    if (query.status) {
      where.id = { in: await this.idsWithStatus(query.status) };
    }

    const [rows, total] = await Promise.all([
      this.prisma.client.due.findMany({
        where,
        include: { party: true },
        orderBy: [{ issueDate: 'desc' }, { id: 'desc' }],
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.due.count({ where }),
    ]);

    // One grouped sum for the page rather than two queries per row.
    const paid = await this.ledger.paidForDues(rows);
    const items = rows.map((row) => this.toDto(row, asOf, paid.get(row.id) ?? ZERO));
    return toPaginatedResult(items, total, page, pageSize);
  }

  async create(dto: CreateDueDto, adminId: number | null): Promise<DueDto> {
    const amount = decimalOrThrow(dto.amount, 'amount');
    if (amount.lessThanOrEqualTo(ZERO)) {
      throw new BadRequestException('Amount must be greater than zero');
    }
    const issueDate = new Date(dto.issueDate);
    await this.ledger.assertPeriodOpen(issueDate);

    const row = await this.prisma.client.$transaction(async (tx) => {
      return tx.due.create({
        data: {
          docNo: await nextDueDocNo(tx as never, dto.kind, issueDate),
          kind: dto.kind,
          partyId: dto.partyId,
          source: dto.source ?? 'MANUAL',
          amount,
          issueDate,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          expenseId: dto.expenseId ?? null,
          orderId: dto.orderId ?? null,
          note: dto.note ?? null,
          createdBy: adminId,
        },
      });
    });

    return this.findOne(row.id);
  }

  async recordPayment(
    id: number,
    dto: RecordDuePaymentDto,
    adminId: number | null,
  ): Promise<DueDto> {
    const due = await this.prisma.client.due.findUnique({ where: { id } });
    if (!due) throw new NotFoundException(`Due ${id} not found`);
    if (due.voidedAt) throw new BadRequestException('That entry is voided');

    const amount = decimalOrThrow(dto.amount, 'amount');
    if (amount.lessThanOrEqualTo(ZERO)) {
      throw new BadRequestException('Payment must be greater than zero');
    }

    const alreadyPaid = await this.ledger.paidForDue(id);
    const remaining = due.amount.minus(alreadyPaid);
    if (amount.greaterThan(remaining)) {
      throw new BadRequestException(
        `Only ৳${remaining.toFixed(2)} is outstanding on ${due.docNo}`,
      );
    }

    const entryDate = new Date(dto.paymentDate);

    // The instalment itself, not a running total. Storing a cumulative
    // paidAmount and re-reading it per period is exactly defect D1.
    await this.prisma.client.$transaction(async (tx) => {
      await this.ledger.post(
        {
          entryDate,
          direction: due.kind === 'RECEIVABLE' ? 'IN' : 'OUT',
          amount,
          accountId: dto.accountId,
          partyId: due.partyId,
          source: due.kind === 'RECEIVABLE' ? 'RECEIVABLE_RECEIPT' : 'PAYABLE_PAYMENT',
          dueId: id,
          reference: dto.reference,
          note: dto.note,
        },
        adminId,
        tx,
      );
    });

    return this.findOne(id);
  }

  async void(id: number, adminId: number | null): Promise<DueDto> {
    const due = await this.prisma.client.due.findUnique({ where: { id } });
    if (!due) throw new NotFoundException(`Due ${id} not found`);
    if (due.voidedAt) throw new BadRequestException('That entry is already voided');
    await this.ledger.assertPeriodOpen(due.issueDate);

    const entries = await this.prisma.client.ledgerEntry.findMany({
      where: { dueId: id, reversalOfId: null },
      select: { id: true },
    });

    await this.prisma.client.$transaction(async (tx) => {
      for (const entry of entries) {
        await this.ledger.reverse(entry.id, adminId, tx);
      }
      await tx.due.update({ where: { id }, data: { voidedAt: new Date() } });
    });

    return this.findOne(id);
  }

  async ageing(kind: DueKind, asOf = new Date()): Promise<AgeingReport> {
    const dues = await this.prisma.client.due.findMany({ where: { kind, voidedAt: null } });

    const buckets: Record<AgeingBucket, { count: number; amount: Prisma.Decimal }> = {
      CURRENT: { count: 0, amount: new Decimal(0) },
      '1_30': { count: 0, amount: new Decimal(0) },
      '31_60': { count: 0, amount: new Decimal(0) },
      '60_PLUS': { count: 0, amount: new Decimal(0) },
    };
    let total = new Decimal(0);
    let weightedAgeDays = new Decimal(0);

    // Ageing scans every open due of this kind, so per-row lookups were the
    // worst offender here — one grouped sum covers the lot.
    const paidByDue = await this.ledger.paidForDues(dues);

    for (const due of dues) {
      const outstanding = due.amount.minus(paidByDue.get(due.id) ?? ZERO);
      // A settled due is not aged — only what is still owed can be overdue.
      if (outstanding.lessThanOrEqualTo(ZERO)) continue;

      const bucket = ageingBucket(due.dueDate, asOf);
      buckets[bucket].count += 1;
      buckets[bucket].amount = buckets[bucket].amount.plus(outstanding);
      total = total.plus(outstanding);
      weightedAgeDays = weightedAgeDays.plus(outstanding.times(overdueDays(due.dueDate, asOf)));
    }

    const formatted = Object.fromEntries(
      Object.entries(buckets).map(([k, v]) => [k, { count: v.count, amount: v.amount.toFixed(2) }]),
    ) as AgeingReport['buckets'];

    return {
      kind,
      buckets: formatted,
      total: total.toFixed(2),
      overdue: total.minus(buckets.CURRENT.amount).toFixed(2),
      averageAgeDays: total.isZero() ? 0 : Math.round(Number(weightedAgeDays.dividedBy(total))),
    };
  }
}
