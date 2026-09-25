type Money = string | number;

/**
 * How an order's tax should be shown on its invoice. Website/manual orders add
 * tax on top (total = subtotal − discount + tax + fees); a POS sale in
 * "prices include VAT" mode stores the VAT it contains, with total = subtotal
 * − discount. Showing that as an added row would make the invoice not add up.
 */
export function orderTaxView(o: {
  subTotal: Money;
  discountAmount: Money;
  taxAmount: Money;
  codFee: Money;
  shippingAmount: Money;
  totalAmount: Money;
}): { included: boolean; ratePercent: number | null; displayDiscount: number } {
  const sub = Number(o.subTotal);
  const tax = Number(o.taxAmount);
  const fees = Number(o.codFee) + Number(o.shippingAmount);
  const total = Number(o.totalAmount);
  // Capped so the discount row never exceeds what was actually deducted
  // (total is floored at 0 server-side).
  const displayDiscount = Math.min(Number(o.discountAmount), sub + tax + fees);
  const net = sub - displayDiscount;
  const included =
    tax > 0 &&
    Math.abs(total - (net + fees)) < 0.01 &&
    Math.abs(total - (net + tax + fees)) >= 0.01;
  const base = included ? net - tax : net;
  const ratePercent =
    tax > 0 && base > 0 ? Math.round((tax / base) * 100) : null;
  return { included, ratePercent, displayDiscount };
}
