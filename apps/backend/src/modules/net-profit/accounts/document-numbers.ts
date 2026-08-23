import { Prisma } from '@amader/db';
import { PrismaService } from '../../../common/prisma/prisma.service';

type Db = PrismaService['client'];

function monthBounds(date: Date): { start: Date; end: Date; yymm: string } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  const yy = String(date.getUTCFullYear()).slice(2);
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return { start, end, yymm: `${yy}${mm}` };
}

/**
 * Next sequence number for a document series within its own month.
 *
 * Derived from the highest existing suffix rather than a row count: a count
 * gives a number that is already taken as soon as someone backdates a voucher
 * into a month that already has some. Voided documents keep their number, so
 * the maximum only ever moves forward.
 *
 * Call this inside the creating transaction. The unique index on the number
 * column is the backstop if two saves still race.
 */
async function nextSequence(
  latestNumber: string | undefined,
  prefix: string,
): Promise<number> {
  if (!latestNumber) return 1;
  const suffix = latestNumber.slice(prefix.length + 1);
  const parsed = Number.parseInt(suffix, 10);
  return Number.isFinite(parsed) ? parsed + 1 : 1;
}

/** EXP-YYMM-NNNN */
export async function nextVoucherNo(db: Db, date: Date): Promise<string> {
  const { start, end, yymm } = monthBounds(date);
  const prefix = `EXP-${yymm}`;
  const latest = await db.expense.findFirst({
    where: { expenseDate: { gte: start, lt: end } },
    orderBy: { voucherNo: 'desc' },
    select: { voucherNo: true },
  });
  const seq = await nextSequence(latest?.voucherNo, prefix);
  return `${prefix}-${String(seq).padStart(4, '0')}`;
}

/** AR-YYMM-NNNN for receivables, AP-YYMM-NNNN for payables. */
export async function nextDueDocNo(
  db: Db,
  kind: 'RECEIVABLE' | 'PAYABLE',
  date: Date,
): Promise<string> {
  const { start, end, yymm } = monthBounds(date);
  const prefix = `${kind === 'RECEIVABLE' ? 'AR' : 'AP'}-${yymm}`;
  const latest = await db.due.findFirst({
    where: { kind: kind as Prisma.EnumDueKindFilter['equals'], issueDate: { gte: start, lt: end } },
    orderBy: { docNo: 'desc' },
    select: { docNo: true },
  });
  const seq = await nextSequence(latest?.docNo, prefix);
  return `${prefix}-${String(seq).padStart(4, '0')}`;
}
