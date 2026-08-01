import { Prisma } from '@amader/db';

// Every write path that recomputes Order.totalAmount from its component
// fields (subTotal/discountAmount/taxAmount/codFee/shippingAmount) reads
// those fields, does arithmetic, then writes back only SOME of them —
// recomputeTotals (item edits) only ever writes {subTotal, totalAmount},
// never shippingAmount/discountAmount, so a concurrent updateAmounts (staff
// editing the shipping fee) or shipments.dispatch (courier quote) racing
// against it can interleave: one writes the new shippingAmount, the other —
// having read the order BEFORE that write — commits a totalAmount computed
// from the OLD shippingAmount afterwards, leaving the row with the NEW
// shippingAmount paired with a totalAmount that never accounted for it.
// Confirmed on a live order (shippingAmount=120, totalAmount excluded it).
// A row lock forces the two transactions to serialize instead of
// interleaving — call this first, inside the same transaction that reads
// the order and later writes its totals.
export async function lockOrderRow(
  tx: Prisma.TransactionClient,
  orderId: number,
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
}
