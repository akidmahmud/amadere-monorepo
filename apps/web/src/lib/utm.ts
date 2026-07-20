const COOKIE_NAME = "amader_utm";
const COOKIE_MAX_AGE_DAYS = 30;
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

export type UtmParams = Partial<Record<(typeof UTM_KEYS)[number], string>>;

// Last-touch capture: if the landing URL carries any utm_* param, it
// overwrites whatever was stored before. Read back via getUtmParams() when
// firing analytics events or creating an order, for campaign attribution.
export function captureUtmParams(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const found: UtmParams = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) found[key] = value;
  }
  if (Object.keys(found).length === 0) return;

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
    utmContent: raw.utm_content,
  };
}
