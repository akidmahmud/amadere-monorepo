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
  } else if (digits.length === 15 && digits.startsWith('008801')) {
    local = digits.slice(4);
  }
  if (!local || !LOCAL_RE.test(local)) return null;
  return `+88${local}`;
}

/** Same acceptance rule as {@link normalizeBdPhone}, without the +88 reshape — for inline form validation where the raw input should stay as typed. */
export function isValidBdPhone(raw: string): boolean {
  return normalizeBdPhone(raw) !== null;
}

/**
 * Same normalization as {@link normalizeBdPhone}, minus the leading "+" —
 * the flat 880XXXXXXXXXX shape (no +, no spaces, no hyphens) used as the
 * site-wide storage format for newly entered/updated phone numbers, and as
 * the shape the SMS gateway's `toUser` field expects (its published API
 * doc's own example: "880XXXXXXXXXX"). Also used to reformat already-
 * stored legacy local-format numbers (01XXXXXXXXX) right before an SMS is
 * actually dispatched, without touching how they're stored.
 */
export function toBdCompact(raw: string): string | null {
  const e164 = normalizeBdPhone(raw);
  return e164 ? e164.slice(1) : null;
}

/**
 * Every plausible stored representation of a BD phone, for lookups — this
 * DB has THREE live formats for the same real-world number, confirmed
 * against real `customers.phone` data (grouped by length): legacy local
 * (01XXXXXXXXX, 11 chars, ~2300 rows — never backfilled), the current
 * site-wide compact form (880XXXXXXXXXX, 13 chars, what {@link toBdCompact}
 * now writes for every new/updated entry), and a smaller batch already
 * stored as E.164 (+8801XXXXXXXXX, 14 chars, ~30 rows — an earlier import/
 * integration wrote these directly). A lookup that only tries one misses
 * every row still in either of the other two — e.g. a returning customer
 * whose original record is "01734113189" checking out again with the same
 * number, now normalized to "8801734113189" by `@NormalizeBdPhone()`,
 * would otherwise silently create a duplicate `Customer` instead of
 * matching their real one. Use as `where: { phone: { in:
 * phoneLookupCandidates(input) } }` (or `.includes()` for an in-memory
 * comparison) anywhere a phone is looked up rather than freshly written.
 * Falls back to `[raw]` for a non-BD-phone-shaped input so an email (or
 * garbage) passed in by mistake still gets *a* candidate to search
 * against instead of silently matching nothing.
 */
export function phoneLookupCandidates(raw: string): string[] {
  const e164 = normalizeBdPhone(raw);
  if (!e164) return [raw];
  return [e164.slice(1), e164.slice(3), e164]; // ["880...", "01...", "+8801..."]
}
