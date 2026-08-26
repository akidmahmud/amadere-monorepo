"use client";

import { Component, type ReactNode } from "react";
import { DefaultCheckoutLayout } from "./DefaultCheckoutLayout";

/**
 * Falls back to the hardcoded arrangement if a published layout throws while
 * rendering (plan §9.2).
 *
 * A class component because that is still the only way to implement
 * componentDidCatch — there is no hook equivalent.
 *
 * The trade this encodes: a checkout that renders the old design is a bad day,
 * a checkout that renders nothing is lost revenue. So an unexpected error in a
 * builder layout must never reach the customer as a blank page.
 *
 * Logged loudly rather than swallowed. Silently serving the fallback would
 * mean a broken published layout could sit unnoticed for weeks while the owner
 * believes their design is live.
 */
export class CheckoutLayoutBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error(
      "[checkout] published layout failed to render; falling back to the default layout.",
      error,
    );
  }

  render() {
    if (this.state.failed) return <DefaultCheckoutLayout />;
    return this.props.children;
  }
}
