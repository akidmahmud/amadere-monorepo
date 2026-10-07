// Derives an order's Source (Order.utmSource, the admin "Source" column) from
// what the storefront captures at checkout (apps/web utm.ts: utm_* params plus
// first-touch referrer/landing info).
//
// Origin (Order.channel) is NOT derived here. A storefront checkout is always
// WEBSITE: Origin records how the order was placed, and the social channels
// (FACEBOOK = "Messenger", INSTAGRAM, TIKTOK…) are for orders staff enter from
// a conversation. Deriving Origin from the referrer filed Facebook-ad website
// orders under Messenger (owner report, 2026-10-07). Where the shopper came
// from lives in Source instead.

export interface AttributionInput {
  utmSource?: string | null;
  referrerDomain?: string | null;
}

function stripWww(domain: string): string {
  return domain.trim().toLowerCase().replace(/^www\./, '');
}

export function deriveSource(
  input: AttributionInput,
  /** The storefront's own host, so a same-site referrer is not read as a referral. */
  ownDomain?: string | null,
): string | null {
  // utm_source wins: it is what the advertiser deliberately tagged, and it
  // survives redirects that rewrite the referrer.
  const utm = input.utmSource?.trim();
  if (utm) return utm;

  const referrer = input.referrerDomain ? stripWww(input.referrerDomain) : null;
  // A referrer from our own domain is internal navigation, not acquisition.
  if (!referrer || (ownDomain && stripWww(ownDomain) === referrer)) return null;
  // Falls back to the referring domain so the Source column shows
  // "m.facebook.com" rather than staying blank.
  return referrer;
}
