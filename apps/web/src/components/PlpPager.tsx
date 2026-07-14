"use client";

import { Pager } from "@amader/ui";
import { AppLink } from "@/components/AppLink";
import { buildPlpHref, type PlpFilters } from "@/lib/plp";

// Owns the `buildHref` closure that `Pager` (a Client Component) needs — its
// parent (ProductListing) is a Server Component, and functions can't be
// passed across that boundary as props, only plain data (basePath + filters).
export function PlpPager({
  basePath,
  filters,
  totalPages,
}: {
  basePath: string;
  filters: PlpFilters;
  totalPages: number;
}) {
  return (
    <Pager
      page={filters.page}
      totalPages={totalPages}
      linkComponent={AppLink}
      buildHref={(page) => buildPlpHref(basePath, { ...filters, page })}
    />
  );
}
