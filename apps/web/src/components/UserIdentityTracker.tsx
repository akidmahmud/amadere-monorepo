"use client";

import { useEffect } from "react";
import { useMe } from "@/hooks/useAuth";
import type { Ga4UserData } from "@/lib/analytics-events";

// GA4's own documented "User-ID via Google Tag Manager" pattern
// (https://support.google.com/analytics/answer/9213390#gtm-web) — a plain
// `dataLayer.push({ user_id })` with no `event` key, read later by a Data
// Layer Variable in the GTM container's GA4 Configuration tag. This is what
// ties one logged-in customer's page views, product views, and eventual
// purchase together under a single GA4 user, instead of them landing as
// disconnected anonymous sessions — no bespoke "what pages did they view"
// object needed, GA4 already builds that report once User-ID is set.
//
// user_data (same shape addressToUserData/pushEcommerceEvent already use
// for checkout events) carries the customer's actual name/email/phone/DOB
// — whatever they gave at registration or have since saved to their profile
// — not just the opaque internal id, per explicit request: an id alone
// isn't something GTM's enhanced-conversions/CAPI tags can match against
// anything. Pushed once per login-state change (not per navigation) — GTM
// keeps top-level dataLayer keys in its running model across pushes (the
// same reason pushEcommerceEvent only has to null out `ecommerce`, not
// `user_id`/`user_data`), so every later event/tag on any subsequent page
// still sees these values without needing to repeat them.
function customerToUserData(me: {
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  dob: string | null;
}): Ga4UserData | undefined {
  if (!me.email && !me.phone && !me.firstName && !me.lastName && !me.dob) return undefined;
  return {
    email: me.email ?? undefined,
    phone_number: me.phone ?? undefined,
    date_of_birth: me.dob ?? undefined,
    address: {
      first_name: me.firstName ?? undefined,
      last_name: me.lastName ?? undefined,
    },
  };
}

export function UserIdentityTracker() {
  const { data: me } = useMe();

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      user_id: me ? String(me.id) : undefined,
      logged_in: !!me,
      user_data: me ? customerToUserData(me) : undefined,
    });
  }, [me]);

  return null;
}
