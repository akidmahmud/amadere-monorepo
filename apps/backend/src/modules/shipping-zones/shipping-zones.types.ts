/** Both locales required — an empty string is a deliberate blank, a missing
 * key is a bug. Same contract as the footer config's Translated. */
export interface Translated {
  en: string;
  bn: string;
}

export interface ShippingZone {
  name: Translated;
  /** What the customer pays, in BDT. */
  fee: number;
  /** Canonical district names from BD_DISTRICTS_BY_DIVISION. */
  districts: string[];
}

export interface ShippingZonesConfig {
  zones: ShippingZone[];
  /** Applied to any district not assigned to a zone, so the admin never has
   * to enumerate all 64 districts to cover the country. */
  fallback: { name: Translated; fee: number };
}
