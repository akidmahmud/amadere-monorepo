"use client";

import { Fragment, ReactNode } from "react";
import { cn } from "../lib/cn";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  /** Render prop so the app's own Link (e.g. next-intl's) can be used for real navigation. */
  renderLink?: (props: { href: string; children: ReactNode }) => ReactNode;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("py-4 font-body text-[13px] text-muted", className)}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        const content =
          item.href && !isLast ? (
            item.renderLink ? (
              item.renderLink({ href: item.href, children: item.label })
            ) : (
              <a href={item.href} className="text-green">
                {item.label}
              </a>
            )
          ) : (
            <span>{item.label}</span>
          );

        return (
          <Fragment key={`${item.label}-${i}`}>
            {i > 0 && <span className="mx-1.5">›</span>}
            {content}
          </Fragment>
        );
      })}
    </nav>
  );
}
