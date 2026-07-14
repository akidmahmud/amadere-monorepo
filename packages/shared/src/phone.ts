// One BD phone normalizer, used everywhere a phone is a lookup/cache key
// (fraud checks, blocker rules, OTP) — CLAUDE.net-profit.md §7.2. Real
// stored phones in this DB are local 11-digit (01XXXXXXXXX, confirmed
// against `customers.phone`/`order_addresses.phone`); also accepts an
// already-dialing-code-prefixed input so admin-typed lookups work too.
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
  if (!local) return null;
  return `+88${local}`;
}
