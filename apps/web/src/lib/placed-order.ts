import type { CheckoutResult } from "@/hooks/useCheckout";

/**
 * Hand-off of a just-placed order from /checkout to /thank-you.
 *
 * Why storage rather than a fetch: `GET /orders/:orderNumber` is behind
 * CustomerJwtGuard, and most buyers here check out as guests — so the
 * thank-you page has no way to ask the server for the order it is meant to
 * show. The browser already has the full order object the checkout call
 * returned, so it carries it across the redirect.
 *
 * Consequence, accepted deliberately: the URL is not shareable and not
 * reachable from another device. Someone who loses the page uses /track,
 * exactly as before.
 */

const ORDER_KEY = "amader:placed-order";
/** Order numbers whose `purchase` event has already been reported. */
const FIRED_KEY = "amader:purchase-fired";
/** Keeps the fired-list from growing without bound in a long-lived browser. */
const FIRED_MAX = 50;

export function storePlacedOrder(order: CheckoutResult): void {
  try {
    sessionStorage.setItem(ORDER_KEY, JSON.stringify(order));
  } catch {
    // Private mode, or storage disabled. The caller falls back to rendering
    // the confirmation inline, so the buyer still sees their order.
  }
}

export function readPlacedOrder(): CheckoutResult | null {
  try {
    const raw = sessionStorage.getItem(ORDER_KEY);
    return raw ? (JSON.parse(raw) as CheckoutResult) : null;
  } catch {
    return null;
  }
}

export function clearPlacedOrder(): void {
  try {
    sessionStorage.removeItem(ORDER_KEY);
  } catch {
    /* nothing to clear */
  }
}

/**
 * True the FIRST time it is called for an order number, false every time
 * after — including after a refresh, a back-button, or reopening the tab
 * days later.
 *
 * This is the whole reason the guard exists. Until now `purchase` could not
 * double-fire only because a refresh destroyed the React state holding the
 * order; giving the confirmation a real URL removes that accident. A
 * duplicated purchase inflates conversions in GA4/Meta, which distorts ROAS
 * and teaches the ad algorithms to bid on the wrong thing.
 *
 * localStorage, not sessionStorage: a new tab or a browser restart must not
 * be able to report the same order twice.
 */
export function markPurchaseFired(orderNumber: string): boolean {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    const fired: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    if (fired.includes(orderNumber)) return false;
    // Newest first, capped — an unbounded list would grow forever on a
    // shared/kiosk browser.
    localStorage.setItem(
      FIRED_KEY,
      JSON.stringify([orderNumber, ...fired].slice(0, FIRED_MAX)),
    );
    return true;
  } catch {
    // Storage unavailable. Fire rather than stay silent: a missing
    // conversion is worse than a rare duplicate, and this path only happens
    // where storage is blocked entirely.
    return true;
  }
}
