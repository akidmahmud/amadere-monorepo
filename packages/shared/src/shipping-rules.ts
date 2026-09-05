// What the COURIER charges us per parcel, as a weight-tiered rate card.
//
// Deliberately separate from shipping-zones.ts: a zone is one flat fee the
// CUSTOMER pays for a district, a rule is the courier's own weight-banded
// price for that same district. They answer different questions and are
// edited by different people, so folding one into the other would mean a
// zone row that sometimes means a fee and sometimes means a rate card.
//
// Shipped pre-loaded with Steadfast's published rate card (see
// STEADFAST_SHIPPING_RULES), which is the only courier in use today.

export type ShippingDeliveryType = 'HOME' | 'POINT';

/** One weight band. `upToKg` is inclusive. */
export interface ShippingRuleTier {
  upToKg: number;
  fee: number;
}

export interface ShippingRule {
  /** Stable across edits so the admin table can key rows without reordering. */
  id: string;
  name: string;
  deliveryType: ShippingDeliveryType;
  /** Canonical BD_DISTRICTS_BY_DIVISION names. Empty = catch-all, and a
   *  catch-all only wins if no earlier rule matched. */
  districts: string[];
  /** Ascending. The first tier whose upToKg >= weight wins outright. */
  tiers: ShippingRuleTier[];
  /** Charged per whole additional kg past the LAST tier. Steadfast rounds
   *  100g–900g up to a full kg, so the overflow is always ceil()'d. */
  perKgFee: number;
}

export interface ShippingRulesConfig {
  /** OFF: checkout keeps quoting the assigned shipping zones. ON: checkout
   *  quotes the rule-calculated amount instead. Admin-only screens (New
   *  Order, Order Manager) show the rule either way — it is a suggestion
   *  there, not a charge. */
  applyOnCheckout: boolean;
  rules: ShippingRule[];
}

export const SHIPPING_RULE_MAX = 40;
export const SHIPPING_RULE_TIER_MAX = 30;

export interface ShippingRuleQuote {
  amount: number;
  ruleId: string;
  ruleName: string;
  weightKg: number;
}

/**
 * The applicable rate for a parcel. Pure so both the API and the admin
 * editor's live preview can call it and never disagree.
 *
 * Returns null when nothing matches — the caller must then fall back to the
 * shipping zones rather than quoting zero.
 */
export function quoteShippingRule(
  config: ShippingRulesConfig,
  input: {
    district?: string | null;
    weightKg: number;
    deliveryType?: ShippingDeliveryType;
  },
): ShippingRuleQuote | null {
  const wanted = input.deliveryType ?? 'HOME';
  const needle = input.district?.trim().toLowerCase() ?? '';
  // A parcel with no recorded weight still ships, and every rate card starts
  // at its lowest band — so price it as the lightest possible parcel rather
  // than refusing to quote.
  const weightKg = input.weightKg > 0 ? input.weightKg : 0;

  const candidates = config.rules.filter((r) => r.deliveryType === wanted);
  const match =
    candidates.find(
      (r) =>
        r.districts.length > 0 &&
        r.districts.some((d) => d.trim().toLowerCase() === needle),
    ) ?? candidates.find((r) => r.districts.length === 0);

  if (!match) return null;
  const tiers = [...match.tiers].sort((a, b) => a.upToKg - b.upToKg);
  if (tiers.length === 0) return null;

  const band = tiers.find((t) => weightKg <= t.upToKg);
  const last = tiers[tiers.length - 1]!;
  const amount = band
    ? band.fee
    : last.fee + Math.ceil(weightKg - last.upToKg) * match.perKgFee;

  return {
    amount: Math.round(amount * 100) / 100,
    ruleId: match.id,
    ruleName: match.name,
    weightKg,
  };
}

// ---------------------------------------------------------------------------
// Steadfast's published rate card, origin Gazipur (our pickup point).
// Source: Stead-Fast_Delivery_Rate_Report.xlsx, supplied by the merchant.
// ---------------------------------------------------------------------------

/** Steadfast's point-delivery ladder is "+৳20/kg up to 7kg, then flat slabs".
 *  Spelling the per-kg region out as explicit tiers keeps the rule model a
 *  dumb list instead of growing a second per-kg boundary field. */
function perKgTiers(from: number, fee: number, to: number, perKg: number): ShippingRuleTier[] {
  const out: ShippingRuleTier[] = [{ upToKg: from, fee }];
  for (let kg = from + 1; kg <= to; kg += 1) {
    out.push({ upToKg: kg, fee: fee + (kg - from) * perKg });
  }
  return out;
}

export const STEADFAST_SHIPPING_RULES: ShippingRulesConfig = {
  applyOnCheckout: false,
  rules: [
    {
      id: 'sf-home-gazipur',
      name: 'Steadfast — Home, within Gazipur',
      deliveryType: 'HOME',
      districts: ['Gazipur'],
      tiers: [{ upToKg: 1, fee: 60 }],
      perKgFee: 20,
    },
    {
      id: 'sf-home-dhaka',
      name: 'Steadfast — Home, Dhaka',
      deliveryType: 'HOME',
      districts: ['Dhaka'],
      tiers: [{ upToKg: 1, fee: 105 }],
      perKgFee: 20,
    },
    {
      id: 'sf-home-dhaka-sub',
      name: 'Steadfast — Home, Dhaka Sub-Urban',
      deliveryType: 'HOME',
      districts: ['Dhaka Sub-Urban'],
      tiers: [
        { upToKg: 0.5, fee: 115 },
        { upToKg: 1, fee: 135 },
      ],
      perKgFee: 20,
    },
    {
      id: 'sf-home-other',
      name: 'Steadfast — Home, other districts',
      deliveryType: 'HOME',
      districts: [],
      tiers: [
        { upToKg: 0.5, fee: 115 },
        { upToKg: 1, fee: 135 },
      ],
      perKgFee: 20,
    },
    {
      id: 'sf-point-gazipur',
      name: 'Steadfast — Point (hub pickup), within Gazipur',
      deliveryType: 'POINT',
      districts: ['Gazipur'],
      tiers: [
        ...perKgTiers(1, 60, 7, 20),
        { upToKg: 10, fee: 200 },
        { upToKg: 15, fee: 225 },
        { upToKg: 20, fee: 250 },
      ],
      perKgFee: 20,
    },
    {
      id: 'sf-point-other',
      name: 'Steadfast — Point (hub pickup), other districts',
      deliveryType: 'POINT',
      districts: [],
      tiers: [
        ...perKgTiers(1, 120, 7, 20),
        { upToKg: 10, fee: 180 },
        { upToKg: 15, fee: 250 },
        { upToKg: 20, fee: 320 },
      ],
      perKgFee: 20,
    },
  ],
};
