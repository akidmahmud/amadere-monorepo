export interface SourceDef {
  key: string;
  label: string;
}

/** Fixed sources in default report order. Wholesale channels (WCH_<id>) are
 *  slotted in before OTHER by settings.allSourceDefs(). */
export const BASE_SOURCES: SourceDef[] = [
  { key: 'WEB_DIRECT', label: 'Website' },
  { key: 'WEB_FACEBOOK', label: 'Website ← Facebook' },
  { key: 'WEB_INSTAGRAM', label: 'Website ← Instagram' },
  { key: 'WEB_TIKTOK', label: 'Website ← TikTok' },
  { key: 'WHATSAPP', label: 'WhatsApp' },
  { key: 'FACEBOOK', label: 'Facebook' },
  { key: 'INSTAGRAM', label: 'Instagram' },
  { key: 'TIKTOK', label: 'TikTok' },
  { key: 'TELESALE', label: 'Telesale' },
  { key: 'SHOP', label: 'Shop sale' },
  { key: 'WHOLESALE', label: 'Wholesale' },
  { key: 'OTHER', label: 'Other' },
];

// ponytail: keyword lists live in code, not settings — move them to settings
// if the owner ever needs to add a platform without a deploy.
// Whole-token match (split on non-alphanumerics), so "digital" is not "ig".
const SOCIAL: [string, string[]][] = [
  ['WEB_FACEBOOK', ['facebook', 'fb', 'messenger']],
  ['WEB_INSTAGRAM', ['instagram', 'ig']],
  ['WEB_TIKTOK', ['tiktok']],
];

const CHANNEL_SOURCE: Record<string, string> = {
  WHATSAPP: 'WHATSAPP',
  FACEBOOK: 'FACEBOOK',
  INSTAGRAM: 'INSTAGRAM',
  TIKTOK: 'TIKTOK',
  PHONE: 'TELESALE',
};

export function retailSourceOf(o: {
  channel: string;
  /** POS: the store the sale was made at. */
  storeId?: number | null;
  utmSource: string | null;
  referrerDomain: string | null;
}): string {
  if (o.channel === 'WEBSITE' || o.channel === 'APP') {
    const tokens = new Set(
      `${o.utmSource ?? ''} ${o.referrerDomain ?? ''}`
        .toLowerCase()
        .split(/[^a-z0-9]+/),
    );
    for (const [key, words] of SOCIAL)
      if (words.some((w) => tokens.has(w))) return key;
    return 'WEB_DIRECT';
  }
  // Each shop is its own source so the report names it.
  if (o.channel === 'POS') return o.storeId ? `SHOP_${o.storeId}` : 'SHOP';
  return CHANNEL_SOURCE[o.channel] ?? 'OTHER';
}

export function wholesaleSourceOf(o: {
  type: 'WHOLESALE' | 'CHANNEL';
  channelId: number | null;
}): string {
  return o.type === 'CHANNEL' && o.channelId != null
    ? `WCH_${o.channelId}`
    : 'WHOLESALE';
}
