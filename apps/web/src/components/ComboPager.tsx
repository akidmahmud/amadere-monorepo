"use client";

import { Pager } from "@amader/ui";
import { AppLink } from "@/components/AppLink";

// Small client wrapper (same reason as PlpPager): the parent listing page is
// a Server Component, and a function prop (buildHref) can't cross that
// boundary — this constructs it from plain data instead.
export function ComboPager({ page, totalPages }: { page: number; totalPages: number }) {
  return (
    <Pager
      page={page}
      totalPages={totalPages}
      linkComponent={AppLink}
      buildHref={(p) => (p === 1 ? "/combos" : `/combos?page=${p}`)}
    />
  );
}
