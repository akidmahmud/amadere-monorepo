"use client";

import { Pager } from "@amader/ui";
import { AppLink } from "@/components/AppLink";

// Same reason as PlpPager: BlogListing is a Server Component, so the
// `buildHref` closure `Pager` needs has to be built by a Client Component.
export function BlogPager({ basePath, page, totalPages }: { basePath: string; page: number; totalPages: number }) {
  return (
    <Pager
      page={page}
      totalPages={totalPages}
      linkComponent={AppLink}
      buildHref={(p) => (p > 1 ? `${basePath}?page=${p}` : basePath)}
    />
  );
}
