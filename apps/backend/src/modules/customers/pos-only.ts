import type { Prisma } from '@amader/db';

/**
 * Leaves POS shop customers out of the website Customer Manager (list,
 * search, stats, export, dashboard count). A customer created at a POS till
 * counts as a website customer again once they order through any other
 * channel or log in to the website. Spread as `...EXCLUDE_POS_ONLY` — it only
 * uses `NOT`, so it never clashes with a where's own AND / OR.
 */
export const EXCLUDE_POS_ONLY: Prisma.CustomerWhereInput = {
  NOT: {
    posOnly: true,
    orders: { none: { channel: { not: 'POS' } } },
    passwordHash: null,
    phoneVerifiedAt: null,
    emailVerifiedAt: null,
  },
};
