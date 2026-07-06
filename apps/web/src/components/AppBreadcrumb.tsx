"use client";

import type { ReactNode } from "react";
import { Breadcrumb, type BreadcrumbItem } from "@amader/ui";
import { AppLink } from "@/components/AppLink";

// Same RSC rule as AppLink: a Server Component can't hand Breadcrumb an
// inline `renderLink` function prop (not a tagged Client Reference). Since
// this whole module is already "use client", building that function here and
// handing it to Breadcrumb never crosses the server/client boundary.
function renderLink({ href, children }: { href: string; children: ReactNode }) {
  return <AppLink href={href}>{children}</AppLink>;
}

export function AppBreadcrumb({ items }: { items: Omit<BreadcrumbItem, "renderLink">[] }) {
  return (
    <Breadcrumb
      items={items.map((item) => ({ ...item, renderLink: item.href ? renderLink : undefined }))}
    />
  );
}
