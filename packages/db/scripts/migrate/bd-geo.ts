// Best-effort Bangladesh division/district detection from free-text address
// strings (confirmed with the user: source ec_customer_addresses/
// ec_order_addresses have NO structured state/city data at all — every one
// of ~5,235 rows only has a single free-text "address" field). Falls back to
// Dhaka/Dhaka (the plurality case) when nothing matches; callers should log
// that fallback so it's reviewable in the migration report. The full
// original text is always preserved separately in addressLine regardless.

// 64 official districts mapped to their division. Matched as a
// case-insensitive substring against the free-text address — cheap and
// explainable, not a geocoder.
const DISTRICT_TO_DIVISION: Record<string, string> = {
  Dhaka: 'Dhaka',
  Gazipur: 'Dhaka',
  Narayanganj: 'Dhaka',
  Narsingdi: 'Dhaka',
  Tangail: 'Dhaka',
  Kishoreganj: 'Dhaka',
  Manikganj: 'Dhaka',
  Munshiganj: 'Dhaka',
  Rajbari: 'Dhaka',
  Madaripur: 'Dhaka',
  Gopalganj: 'Dhaka',
  Faridpur: 'Dhaka',
  Shariatpur: 'Dhaka',
  Chattogram: 'Chattogram',
  Chittagong: 'Chattogram',
  "Cox's Bazar": 'Chattogram',
  Coxsbazar: 'Chattogram',
  Cumilla: 'Chattogram',
  Comilla: 'Chattogram',
  Feni: 'Chattogram',
  Brahmanbaria: 'Chattogram',
  Rangamati: 'Chattogram',
  Noakhali: 'Chattogram',
  Chandpur: 'Chattogram',
  Lakshmipur: 'Chattogram',
  Khagrachari: 'Chattogram',
  Bandarban: 'Chattogram',
  Rajshahi: 'Rajshahi',
  Bogura: 'Rajshahi',
  Bogra: 'Rajshahi',
  Pabna: 'Rajshahi',
  Sirajganj: 'Rajshahi',
  Natore: 'Rajshahi',
  Naogaon: 'Rajshahi',
  Chapainawabganj: 'Rajshahi',
  Joypurhat: 'Rajshahi',
  Khulna: 'Khulna',
  Jashore: 'Khulna',
  Jessore: 'Khulna',
  Satkhira: 'Khulna',
  Bagerhat: 'Khulna',
  Narail: 'Khulna',
  Chuadanga: 'Khulna',
  Kushtia: 'Khulna',
  Magura: 'Khulna',
  Meherpur: 'Khulna',
  Jhenaidah: 'Khulna',
  Barishal: 'Barishal',
  Barisal: 'Barishal',
  Bhola: 'Barishal',
  Patuakhali: 'Barishal',
  Pirojpur: 'Barishal',
  Barguna: 'Barishal',
  Jhalokati: 'Barishal',
  Sylhet: 'Sylhet',
  Moulvibazar: 'Sylhet',
  Habiganj: 'Sylhet',
  Sunamganj: 'Sylhet',
  Rangpur: 'Rangpur',
  Dinajpur: 'Rangpur',
  Kurigram: 'Rangpur',
  Gaibandha: 'Rangpur',
  Nilphamari: 'Rangpur',
  Lalmonirhat: 'Rangpur',
  Panchagarh: 'Rangpur',
  Thakurgaon: 'Rangpur',
  Mymensingh: 'Mymensingh',
  Jamalpur: 'Mymensingh',
  Sherpur: 'Mymensingh',
  Netrokona: 'Mymensingh',
  // Common abbreviations/misspellings actually seen in Bangladeshi COD addresses.
  Ctg: 'Chattogram',
  Dhk: 'Dhaka',
};

const FALLBACK_DIVISION = 'Dhaka';
const FALLBACK_DISTRICT = 'Dhaka';

export interface DetectedLocation {
  division: string;
  district: string;
  matched: boolean;
}

export function detectDivisionDistrict(addressText: string): DetectedLocation {
  const haystack = addressText.toLowerCase();

  for (const [district, division] of Object.entries(DISTRICT_TO_DIVISION)) {
    if (haystack.includes(district.toLowerCase())) {
      return { division, district, matched: true };
    }
  }

  return { division: FALLBACK_DIVISION, district: FALLBACK_DISTRICT, matched: false };
}
