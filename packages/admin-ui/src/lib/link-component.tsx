import type { AnchorHTMLAttributes, ComponentType } from "react";

/**
 * Every nav/link-bearing component accepts the app's own routing Link (e.g.
 * next/link) instead of hardcoding it — keeps this package framework-
 * agnostic and Storybook-renderable. Defaults to a plain anchor.
 */
export type LinkComponent = ComponentType<AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }>;

export const DefaultLink: LinkComponent = ({ href, children, ...props }) => (
  <a href={href} {...props}>
    {children}
  </a>
);
