import { OrderChannel } from '@amader/db';

// Derives an order's acquisition channel and source from what the storefront
// already captures at checkout (apps/web utm.ts: utm_* params plus first-touch
// referrer/landing info).
//
// Before this, checkout.service.ts hardcoded `channel: 'WEBSITE'` for every
// storefront order and left Source bound to raw `utmSource`. A customer who
// tapped an unparameterised Facebook link therefore arrived with
// referrerDomain = "m.facebook.com" and still got channel WEBSITE and a blank
// Source — even though the data identifying Facebook was sitting in the same
// row. The Order.channel comment in schema.prisma is explicit that this
// breakdown is what ad spend is decided from, so guessing WEBSITE for
// everything actively misinforms that decision.

const DOMAIN_CHANNELS: { match: RegExp; channel: OrderChannel }[] = [
  // l./lm. are Facebook's own link-shim hosts; a tapped ad or post arrives
  // from those as often as from m.facebook.com.
  { match: /(^|\.)(facebook\.com|fb\.com|fb\.me)$/i, channel: 'FACEBOOK' },
  { match: /(^|\.)instagram\.com$/i, channel: 'INSTAGRAM' },
  { match: /(^|\.)(tiktok\.com|tiktokcdn\.com)$/i, channel: 'TIKTOK' },
  { match: /(^|\.)(youtube\.com|youtu\.be)$/i, channel: 'YOUTUBE' },
  { match: /(^|\.)(twitter\.com|x\.com|t\.co)$/i, channel: 'X' },
];

// utm_source is free text an advertiser types, so match loosely on substrings
// rather than exact hosts — "fbads", "fb_ads", "facebook-retargeting" and
// "FB" all mean Facebook.
const UTM_CHANNELS: { match: RegExp; channel: OrderChannel }[] = [
  { match: /(facebook|fbads|fb[_-]?ads|^fb$|meta)/i, channel: 'FACEBOOK' },
  { match: /(instagram|^ig$|insta)/i, channel: 'INSTAGRAM' },
  { match: /tiktok/i, channel: 'TIKTOK' },
  { match: /(youtube|^yt$)/i, channel: 'YOUTUBE' },
  { match: /(twitter|^x$)/i, channel: 'X' },
  { match: /whatsapp/i, channel: 'WHATSAPP' },
];

export interface AttributionInput {
  utmSource?: string | null;
  referrerDomain?: string | null;
}

export interface DerivedAttribution {
  channel: OrderChannel;
  /** Written to Order.utmSource — the admin "Source" column reads that field. */
  utmSource: string | null;
}

function stripWww(domain: string): string {
  return domain.trim().toLowerCase().replace(/^www\./, '');
}

export function deriveAttribution(
  input: AttributionInput,
  /** The storefront's own host, so a same-site referrer is not read as a referral. */
  ownDomain?: string | null,
): DerivedAttribution {
  const utm = input.utmSource?.trim() || null;
  const referrer = input.referrerDomain ? stripWww(input.referrerDomain) : null;

  // utm_source wins: it is what the advertiser deliberately tagged, and it
  // survives redirects that rewrite the referrer.
  if (utm) {
    const hit = UTM_CHANNELS.find((c) => c.match.test(utm));
    return { channel: hit?.channel ?? 'WEBSITE', utmSource: utm };
  }

  // A referrer from our own domain is internal navigation, not acquisition.
  if (referrer && ownDomain && stripWww(ownDomain) === referrer) {
    return { channel: 'WEBSITE', utmSource: null };
  }

  if (referrer) {
    const hit = DOMAIN_CHANNELS.find((c) => c.match.test(referrer));
    // Source falls back to the referring domain so the admin column shows
    // "m.facebook.com" rather than staying blank. Search engines and unknown
    // referrers stay WEBSITE but still record where they came from.
    return { channel: hit?.channel ?? 'WEBSITE', utmSource: referrer };
  }

  // Direct traffic: no tag, no referrer. WEBSITE with nothing to attribute.
  return { channel: 'WEBSITE', utmSource: null };
}
