/**
 * Refund for returning some items: their share of what was paid
 * (total × their price / subtotal). The last return takes exactly what is
 * left. Mirrors PosSaleService.returnSale — the server's figure is final.
 */
export function refundEstimate(
  sale: { subTotal: string; totalAmount: string; posRefundedAmount?: string },
  picked: { unitPrice: string; qty: number }[],
  everythingLeft: boolean,
): number {
  const total = Number(sale.totalAmount);
  const left = total - Number(sale.posRefundedAmount ?? 0);
  if (!picked.length) return 0;
  if (everythingLeft) return round(left);
  const sub = Number(sale.subTotal);
  if (!sub) return 0;
  const gross = picked.reduce((s, p) => s + Number(p.unitPrice) * p.qty, 0);
  return Math.min(round((total * gross) / sub), round(left));
}

const round = (n: number) => Math.round(n * 100) / 100;
