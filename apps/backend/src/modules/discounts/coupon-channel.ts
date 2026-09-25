/**
 * Where a coupon may be used. `pos` is the till context (absent = website or
 * phone-order checkout). Returns the customer-facing reason, or null if OK.
 */
export function couponChannelError(
  coupon: { channel: 'ALL' | 'POS'; storeId: number | null },
  pos?: { storeId: number },
): string | null {
  if (coupon.channel === 'POS' && !pos)
    return 'This code is only valid in store';
  if (coupon.storeId !== null && pos && coupon.storeId !== pos.storeId) {
    return "This code isn't valid at this store";
  }
  return null;
}
