/**
 * Seeded review authors — customer rows that exist only to satisfy a schema
 * constraint, and must never appear in the CRM.
 *
 * `reviews.customer_id` is NOT NULL with a foreign key to `customers`, and the
 * public reviewer name is rendered from `customer.first_name`. So reviews
 * collected outside the storefront (existing customers, Facebook comments)
 * cannot be stored without a customer row. `seed-reviews.ts` creates one per
 * distinct reviewer name, addressed at a domain under `.invalid` — reserved by
 * RFC 2606 and guaranteed never to resolve, so no mail can reach one — with no
 * phone and no password hash, so nobody can log in as one.
 *
 * They are still real rows, so every admin-facing customer list and count has
 * to exclude them explicitly. This module is the single definition of "which
 * rows are those", imported by both the seed script that writes them and the
 * queries that hide them, so the two cannot drift apart.
 */

/** Every seeded reviewer's email ends with this. */
export const SEEDED_REVIEWER_EMAIL_DOMAIN = '@seed.invalid';

/**
 * Prisma `where` fragment excluding seeded reviewers. Spread into a customer
 * query at the top level:
 *
 *   where: { deletedAt: null, ...EXCLUDE_SEEDED_REVIEWERS }
 *
 * The `OR` is load-bearing, not defensive style. `email` is nullable — the
 * storefront's phone-first OTP signup creates customers with no email at all —
 * and in SQL `email NOT LIKE '%@seed.invalid'` evaluates to NULL, not true,
 * when email is NULL. A WHERE clause treats that as false. Verified against a
 * real database rather than assumed: the plain `{ email: { not: ... } }` form
 * returned only the customer with a real email, silently dropping the
 * phone-only one. That would have hidden most of the live customer base from
 * the CRM.
 *
 * Only spread this where nothing else sets a top-level `OR` — Prisma would
 * take the later key and drop the earlier one.
 *
 * Deliberately not `as const`: that widens to a readonly array, which Prisma's
 * generated `CustomerWhereInput` rejects. Nothing mutates this object — it is
 * only ever spread into a fresh `where`.
 */
export const EXCLUDE_SEEDED_REVIEWERS = {
  OR: [
    { email: null },
    { email: { not: { endsWith: SEEDED_REVIEWER_EMAIL_DOMAIN } } },
  ],
};
