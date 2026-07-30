// One BD phone normalizer, used everywhere a phone is a lookup/cache key
// (fraud checks, blocker rules, OTP) — CLAUDE.net-profit.md §7.2 — AND, as
// of the site-wide mobile validation pass, the single source of truth for
// "is this a valid Bangladeshi mobile number" on every phone field across
// the admin and storefront. Real stored phones in this DB are local
// 11-digit (01XXXXXXXXX, confirmed against `customers.phone`/
// `order_addresses.phone`); also accepts an already-dialing-code-prefixed
// input so admin-typed lookups work too. Deliberately accepts any digit
// after "01" (not just the 3-9 mobile-operator range) — business call: any
// 11-digit 01-prefixed number should be accepted, not just current operator
// ranges.
const LOCAL_RE = /^01\d{9}$/;

export function normalizeBdPhone(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, '');
  let local: string | null = null;
  if (digits.length === 11 && digits.startsWith('01')) {
    local = digits;
  } else if (digits.length === 13 && digits.startsWith('8801')) {
    local = digits.slice(2);
  } else if (digits.length === 14 && digits.startsWith('008801')) {
    local = digits.slice(4);
  }
  if (!local || !LOCAL_RE.test(local)) return null;
  return `+88${local}`;
}

/** Same acceptance rule as {@link normalizeBdPhone}, without the +88 reshape — for inline form validation where the raw input should stay as typed. */
export function isValidBdPhone(raw: string): boolean {
  return normalizeBdPhone(raw) !== null;
}
