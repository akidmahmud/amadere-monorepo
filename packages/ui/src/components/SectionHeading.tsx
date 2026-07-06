"use client";

import { ReactNode } from "react";
import { cn } from "../lib/cn";
import { DefaultLink, type LinkComponent } from "../lib/link-component";

export interface SectionHeadingProps {
  children: ReactNode;
  className?: string;
}

export function SectionHeading({ children, className }: SectionHeadingProps) {
  return (
    <div className={cn("mb-6 text-center", className)}>
      <h2 className="font-serif text-[30px] font-semibold text-green">
        {children}
      </h2>
    </div>
  );
}

export interface ViewAllLinkProps {
  href: string;
  children?: ReactNode;
  linkComponent?: LinkComponent;
}

export function ViewAllLink({
  href,
  children = "View All",
  linkComponent: Link = DefaultLink,
}: ViewAllLinkProps) {
  return (
    <Link
      href={href}
      className="mt-4 block text-center font-body text-[13px] text-ink hover:text-green"
    >
      {children}
    </Link>
  );
}
