"use client";

import { useEffect } from "react";
import { useMe } from "@/hooks/useAuth";

// GA4's own documented "User-ID via Google Tag Manager" pattern
// (https://support.google.com/analytics/answer/9213390#gtm-web) — a plain
// `dataLayer.push({ user_id })` with no `event` key, read later by a Data
// Layer Variable in the GTM container's GA4 Configuration tag. This is what
// ties one logged-in customer's page views, product views, and eventual
// purchase together under a single GA4 user, instead of them landing as
// disconnected anonymous sessions — no bespoke "what pages did they view"
// object needed, GA4 already builds that report once User-ID is set.
//
// Pushed once per login-state change (not per navigation) — GTM keeps
// top-level dataLayer keys in its running model across pushes (the same
// reason pushEcommerceEvent only has to null out `ecommerce`, not `user_id`),
// so every later event/tag on any subsequent page still sees this value.
export function UserIdentityTracker() {
  const { data: me } = useMe();

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      user_id: me ? String(me.id) : undefined,
      logged_in: !!me,
    });
  }, [me]);

  return null;
}
