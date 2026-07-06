import type { AnchorHTMLAttributes, ComponentType } from "react";

/**
 * Every layout component accepts the app's own routing Link (e.g. next-intl's,
 * which handles the locale prefix) instead of hardcoding next/link — keeps
 * this package framework-agnostic. Defaults to a plain anchor.
 */
export type LinkComponent = ComponentType<
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
>;

export const DefaultLink: LinkComponent = ({ href, children, ...props }) => (
  <a href={href} {...props}>
    {children}
  </a>
);
