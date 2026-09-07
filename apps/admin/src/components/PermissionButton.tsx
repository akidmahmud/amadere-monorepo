"use client";

import { Button, type ButtonProps } from "@amader/admin-ui";
import { useCan } from "@/hooks/useAdminAuth";

/**
 * A Button that disables itself when the signed-in admin lacks a permission,
 * instead of vanishing or firing a request that comes back 403.
 *
 * Why disabled and not hidden: a control that is simply absent is
 * indistinguishable from a broken page. That is exactly how the shipping-rule
 * quote failed — staff without `shipping_zone.view` got a 403, nothing
 * rendered, and there was no way to tell "you may not do this" from "this
 * feature is broken". A greyed-out button with a reason is self-explaining and
 * tells the admin which permission to ask their manager for.
 *
 * Hiding is still right for whole navigation entries — a menu full of dead
 * links is its own kind of noise — so this is deliberately about ACTIONS.
 *
 * Mirrors the backend guard exactly: `useCan` returns true for a super admin
 * (who bypasses every check) and false while /me is still loading, so a
 * control starts disabled and enables once permissions are known rather than
 * flickering out from under a click.
 */
export function PermissionButton({
  requires,
  deniedTitle,
  disabled,
  title,
  ...props
}: ButtonProps & {
  /** Permission key, e.g. "product.update". Same string the backend guards on. */
  requires: string;
  /** Overrides the default explanation shown on hover when not permitted. */
  deniedTitle?: string;
}) {
  const allowed = useCan(requires);
  return (
    <Button
      {...props}
      disabled={disabled || !allowed}
      title={
        allowed
          ? title
          : (deniedTitle ?? `You do not have permission for this (${requires})`)
      }
      aria-disabled={disabled || !allowed}
    />
  );
}

/**
 * The same gate for anything that is not a Button — a whole panel, a form, a
 * row of inputs. Renders children with pointer events off and dimmed, so the
 * screen still shows WHAT exists, just not editable.
 *
 * `fallback` replaces the children outright where dimming would be confusing.
 */
export function PermissionGate({
  requires,
  children,
  fallback,
}: {
  requires: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const allowed = useCan(requires);
  if (allowed) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;
  return (
    <div
      className="pointer-events-none select-none opacity-50"
      aria-disabled
      title={`You do not have permission for this (${requires})`}
    >
      {children}
    </div>
  );
}
