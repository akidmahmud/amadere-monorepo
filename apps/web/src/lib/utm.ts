const COOKIE_NAME = "amader_utm";
const COOKIE_MAX_AGE_DAYS = 30;
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
const ATTRIBUTION_KEYS = ["landing_domain", "landing_page", "referrer_url", "referrer_domain"] as const;

export type UtmParams = Partial<Record<(typeof UTM_KEYS)[number] | (typeof ATTRIBUTION_KEYS)[number], string>>;

// utm_* is last-touch (a later ad click overwrites the earlier one).
// Referral/landing is first-touch instead — re-visiting the site directly
// later shouldn't overwrite "how this customer originally found us" — so
// it's only captured once per 30-day cookie window. Unconditional on utm_*
// being present: most real referral traffic (organic search, a shared
// link) carries no utm_ param at all, so gating on that would silently
// drop attribution for the majority of visits.
export function captureUtmParams(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const existing = getUtmParams();
  const found: UtmParams = { ...existing };
  let changed = false;

  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) {
      found[key] = value;
      changed = true;
    }
  }

  if (!existing.landing_domain) {
    found.landing_domain = window.location.hostname;
    found.landing_page = window.location.pathname;
    if (document.referrer && !document.referrer.startsWith(window.location.origin)) {
      found.referrer_url = document.referrer;
      try {
        found.referrer_domain = new URL(document.referrer).hostname;
      } catch {
        /* malformed referrer URL, skip domain parse */
      }
    }
    changed = true;
  }

  if (!changed) return;
  const expires = new Date(Date.now() + COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(found))}; expires=${expires}; path=/; SameSite=Lax`;
}

export function getUtmParams(): UtmParams {
  if (typeof document === "undefined") return {};
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  if (!match) return {};
  try {
    return JSON.parse(decodeURIComponent(match[1])) as UtmParams;
  } catch {
    return {};
  }
}

export interface CheckoutUtmFields {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  landingDomain?: string;
  landingPage?: string;
  referrerUrl?: string;
  referrerDomain?: string;
}

// The checkout DTO's fields are camelCase (utmSource) while the cookie/URL
// keys are snake_case (utm_source, matching how every ad platform actually
// names the query params) — this is the one place that mapping happens, so
// getUtmParams() itself stays in the ad-platform-standard shape for analytics
// event payloads (GA4/Meta/TikTok all expect snake_case utm_* keys there).
export function getUtmParamsForCheckout(): CheckoutUtmFields {
  const raw = getUtmParams();
  return {
    utmSource: raw.utm_source,
    utmMedium: raw.utm_medium,
    utmCampaign: raw.utm_campaign,
    utmTerm: raw.utm_term,
    landingDomain: raw.landing_domain,
    landingPage: raw.landing_page,
    referrerUrl: raw.referrer_url,
    referrerDomain: raw.referrer_domain,
    utmContent: raw.utm_content,
  };
}
