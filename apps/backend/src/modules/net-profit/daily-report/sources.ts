export interface SourceDef {
  key: string;
  label: string;
}

/** Fixed sources in default report order. Wholesale channels (WCH_<id>) are
 *  slotted in before OTHER by settings.allSourceDefs(). */
export const BASE_SOURCES: SourceDef[] = [
  // One "Website" block (owner, 2026-10-05): no split by Facebook /
  // Instagram / TikTok referral.
  { key: 'WEB_DIRECT', label: 'Website' },
  { key: 'WHATSAPP', label: 'WhatsApp Official' },
  { key: 'WHATSAPP_PERSONAL', label: 'WhatsApp Personal' },
  { key: 'FACEBOOK', label: 'Messenger' },
  { key: 'INSTAGRAM', label: 'Instagram' },
  { key: 'TIKTOK', label: 'TikTok' },
  { key: 'TELESALE', label: 'Telesale' },
  { key: 'SHOP', label: 'Shop sale' },
  { key: 'WHOLESALE', label: 'Wholesale' },
  { key: 'OTHER', label: 'Other' },
];

const CHANNEL_SOURCE: Record<string, string> = {
  WHATSAPP: 'WHATSAPP',
  WHATSAPP_PERSONAL: 'WHATSAPP_PERSONAL',
  FACEBOOK: 'FACEBOOK',
  INSTAGRAM: 'INSTAGRAM',
  TIKTOK: 'TIKTOK',
  PHONE: 'TELESALE',
};

/**
 * Recreated from an abandoned website cart (order number "REC-..."). Always
 * reported as a Website sale, even if staff later changed its Origin.
 */
export const isRecoveredOrder = (orderNumber?: string | null) =>
  !!orderNumber?.startsWith('REC-');

export function retailSourceOf(o: {
  channel: string;
  /** POS: the store the sale was made at. */
  storeId?: number | null;
  utmSource: string | null;
  referrerDomain: string | null;
}): string {
  if (o.channel === 'WEBSITE' || o.channel === 'APP') return 'WEB_DIRECT';
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
