"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { toApiLocale } from "@/lib/api-locale";
import { useApplyCoupon, useCartQuery } from "@/hooks/useCart";

const PENDING_KEY = "amader_pending_coupon";

function remember(code: string) {
  try {
    window.localStorage.setItem(PENDING_KEY, code);
  } catch {
    // Private mode. The apply below still runs for this page load.
  }
}

function recall(): string | null {
  try {
    return window.localStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

function forget() {
  try {
    window.localStorage.removeItem(PENDING_KEY);
  } catch {
    // Nothing to clean up if storage was never readable.
  }
}

/**
 * Applies a coupon that arrived in a link, e.g. the abandoned-cart email's
 * `/cart?coupon=SAVE10`.
 *
 * Why it is not simply "apply on page load": the cart may be empty at that
 * moment. People read the email on their phone having abandoned the cart on a
 * laptop, so there is nothing yet to discount. The code is therefore REMEMBERED
 * and applied as soon as a cart with items exists — which may be several pages
 * later, after they have re-added everything.
 *
 * The server still validates it. This only saves the customer from retyping a
 * code, and a code that has to be retyped is one most of them abandon.
 */
export function CouponFromLink() {
  const searchParams = useSearchParams();
  // toApiLocale, like every other cart caller: the API wants "EN"/"BN" and
  // rejects a lowercase locale with a 400. Reading it off useParams also fails
  // outright on /checkout, where the locale is not in the path.
  const locale = toApiLocale(useLocale());
  // The SAME query key the drawer and checkout use, so this reads their cached
  // cart instead of firing a second request for the same data.
  const { data: cart } = useCartQuery(locale);
  const applyCoupon = useApplyCoupon(locale);
  // One attempt per code per page session. Without this, a failed apply would
  // retry on every cart refetch and hammer the endpoint.
  const attempted = useRef<string | null>(null);

  // Capture as early as possible: the visitor may never reach a cart page, and
  // the parameter is gone the moment they navigate away.
  useEffect(() => {
    const fromUrl = searchParams?.get("coupon")?.trim();
    if (fromUrl) remember(fromUrl);
  }, [searchParams]);

  useEffect(() => {
    const code = searchParams?.get("coupon")?.trim() || recall();
    if (!code || attempted.current === code) return;
    // Nothing to apply a discount to yet — wait for items.
    if (!cart || cart.items.length === 0) return;
    // Already has one. Not overwritten: a coupon they chose by hand beats one
    // that arrived in a link.
    if (cart.couponCode) {
      forget();
      return;
    }

    attempted.current = code;
    applyCoupon.mutate(
      { code },
      {
        // Cleared either way. Applied: its job is done. Rejected (expired,
        // minimum not met, wrong customer): it would fail identically on every
        // later page, and retrying forever helps nobody.
        onSuccess: forget,
        onError: forget,
      },
    );
    // applyCoupon is a stable mutation object; including it would re-run this
    // on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, searchParams]);

  return null;
}
