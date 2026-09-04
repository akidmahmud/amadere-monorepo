// How a UTM source is grouped for display and filtering.
//
// Lives in shared because BOTH ends need the same answer: the admin renders the
// Source column with it, and the backend filters SQL with it. A copy in each
// would drift, and a filter that disagreed with the column above it would make
// both untrustworthy.

/** The sources staff can pick in the Source column. */
export const ORDER_SOURCES = [
  'facebook',
  // Paid Facebook traffic kept separate from organic: "how much came from the
  // ads" is the question this column exists to answer, and folding fbads into
  // facebook makes it unanswerable.
  'fbads',
  'instagram',
  'whatsapp',
  'website',
  'Telisell',
  'localsell',
  'wholesell',
  'tiktok',
  'youtube',
] as const;

/** utm_source spellings that all mean "paid Facebook". */
export const FB_PAID_SOURCES = ['fbads', 'fb-ads', 'fb_ads', 'facebook-ads', 'facebookads'];

/**
 * What to SHOW for a stored utm_source.
 *
 * Real UTMs are messy — `fb`, `FB`, `facebook.com`, `m.facebook.com`,
 * `facebook-qa-test` all mean Facebook. Anything Facebook-ish collapses to the
 * canonical `facebook`, EXCEPT an explicit paid marker, which stays `fbads`.
 *
 * Returns null when the value is not Facebook-related at all — the caller then
 * shows it verbatim rather than guessing at it.
 */
export function canonicalFacebookSource(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (FB_PAID_SOURCES.includes(v)) return 'fbads';
  if (v === 'fb' || v.includes('facebook')) return 'facebook';
  return null;
}
