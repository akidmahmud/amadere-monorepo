"use client";

import { ReactNode } from "react";
import { cn } from "../lib/cn";
import { DefaultLink, type LinkComponent } from "../lib/link-component";

export interface SectionHeadingProps {
  children: ReactNode;
  className?: string;
  /**
   * Heading level. Defaults to h2, which is right for the "one section among
   * many" case this is named for.
   *
   * Category, brand and tag pages use it for the page's PRIMARY heading
   * though — the category name IS what the page is about — so they were
   * shipping a document whose highest heading was an h2 and which therefore
   * had no h1 at all. Passing `as="h1"` fixes the outline without touching
   * the styling, which is deliberately identical either way: the visual
   * weight belongs to the design, the level belongs to the document
   * structure, and they do not have to agree.
   */
  as?: "h1" | "h2";
}

export function SectionHeading({ children, className, as: Tag = "h2" }: SectionHeadingProps) {
  return (
    <div className={cn("mb-6 text-center", className)}>
      <Tag className="font-serif text-[22px] font-semibold text-green md:text-[30px]">
        {children}
      </Tag>
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
