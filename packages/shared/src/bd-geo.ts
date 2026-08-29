// Canonical Bangladesh division/district reference data for address forms —
// the 8 official divisions, each with its official districts (deduplicated,
// no aliases/abbreviations, unlike the free-text matcher in
// packages/db/scripts/migrate/bd-geo.ts, which intentionally includes those
// for guessing a division out of messy legacy address text).
export const BD_DISTRICTS_BY_DIVISION: Record<string, string[]> = {
  Dhaka: [
    'Dhaka',
    // Not an official government district — a delivery district, added per
    // explicit request so the areas couriers treat as sub-urban Dhaka
    // (Savar, Ashulia, Keraniganj, Dhamrai, Dohar, Nawabganj) can be picked
    // and priced separately from Dhaka metro. Listed right after 'Dhaka' so
    // the two read together in the (otherwise alphabetical-by-division)
    // source, though every dropdown sorts alphabetically anyway.
    //
    // It sits in the Dhaka division on purpose: divisionForDistrict below is
    // what every address write derives `division` from, and a district in no
    // division would resolve to null and store a blank one.
    'Dhaka Sub-Urban',
    'Gazipur',
    'Narayanganj',
    'Narsingdi',
    'Tangail',
    'Kishoreganj',
    'Manikganj',
    'Munshiganj',
    'Rajbari',
    'Madaripur',
    'Gopalganj',
    'Faridpur',
    'Shariatpur',
  ],
  Chattogram: [
    'Chattogram',
    "Cox's Bazar",
    'Cumilla',
    'Feni',
    'Brahmanbaria',
    'Rangamati',
    'Noakhali',
    'Chandpur',
    'Lakshmipur',
    'Khagrachari',
    'Bandarban',
  ],
  Rajshahi: [
    'Rajshahi',
    'Bogura',
    'Pabna',
    'Sirajganj',
    'Natore',
    'Naogaon',
    'Chapainawabganj',
    'Joypurhat',
  ],
  Khulna: [
    'Khulna',
    'Jashore',
    'Satkhira',
    'Bagerhat',
    'Narail',
    'Chuadanga',
    'Kushtia',
    'Magura',
    'Meherpur',
    'Jhenaidah',
  ],
  Barishal: ['Barishal', 'Bhola', 'Patuakhali', 'Pirojpur', 'Barguna', 'Jhalokati'],
  Sylhet: ['Sylhet', 'Moulvibazar', 'Habiganj', 'Sunamganj'],
  Rangpur: [
    'Rangpur',
    'Dinajpur',
    'Kurigram',
    'Gaibandha',
    'Nilphamari',
    'Lalmonirhat',
    'Panchagarh',
    'Thakurgaon',
  ],
  Mymensingh: ['Mymensingh', 'Jamalpur', 'Sherpur', 'Netrokona'],
};

export const BD_DIVISIONS = Object.keys(BD_DISTRICTS_BY_DIVISION);

// Every BD district belongs to exactly one division, so a customer only
// ever needs to pick a district — division is fully determined by it and
// doesn't need to be a separate thing they (or staff) fill in by hand.
// Case-insensitive since free-text district fields (e.g. admin's manual
// order form) won't always match the canonical casing above.
const DIVISION_BY_DISTRICT: Record<string, string> = Object.fromEntries(
  Object.entries(BD_DISTRICTS_BY_DIVISION).flatMap(([division, districts]) =>
    districts.map((district) => [district.toLowerCase(), division]),
  ),
);

export function divisionForDistrict(district: string): string | null {
  return DIVISION_BY_DISTRICT[district.trim().toLowerCase()] ?? null;
}

// Flat list of every district, in division order. Used where a feature needs
// to validate or offer the whole set rather than work division-by-division
// (e.g. shipping-zone district assignment).
export const BD_ALL_DISTRICTS: string[] = Object.values(BD_DISTRICTS_BY_DIVISION).flat();

/** Case-insensitive membership check against the canonical district list. */
export function isKnownDistrict(district: string): boolean {
  return divisionForDistrict(district) !== null;
}
