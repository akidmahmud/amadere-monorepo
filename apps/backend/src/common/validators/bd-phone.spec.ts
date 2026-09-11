import { normalizeBdPhone, toAsciiDigits } from '@amader/shared';

/**
 * The phone normalizer is the site's identity key — carts, OTP, fraud lookups
 * and courier bookings all hang off it — so the shapes customers actually type
 * are worth pinning down.
 */
describe('normalizeBdPhone', () => {
  const E164 = '+8801711123456';

  it('accepts the shapes already in use', () => {
    expect(normalizeBdPhone('01711123456')).toBe(E164);
    expect(normalizeBdPhone('+8801711123456')).toBe(E164);
    expect(normalizeBdPhone('008801711123456')).toBe(E164);
    expect(normalizeBdPhone('01711-123456')).toBe(E164);
    expect(normalizeBdPhone('01711 123 456')).toBe(E164);
  });

  // A Bangla keyboard on Android types these by default. Before Bengali
  // numerals were transliterated, `\d` (ASCII-only in JS) stripped every
  // character and the number was rejected — the shopper saw "enter a valid
  // phone number" while looking at a correct one in their own script.
  describe('Bengali numerals', () => {
    it('accepts a number typed entirely in Bengali digits', () => {
      expect(normalizeBdPhone('০১৭১১১২৩৪৫৬')).toBe(E164);
    });

    it('accepts Bengali digits with a dialing code, spaces or dashes', () => {
      expect(normalizeBdPhone('+৮৮০১৭১১১২৩৪৫৬')).toBe(E164);
      expect(normalizeBdPhone('০১৭১১ ১২৩৪৫৬')).toBe(E164);
      expect(normalizeBdPhone('০১৭১১-১২৩৪৫৬')).toBe(E164);
    });

    // Autocomplete filling half the field, or a keyboard switched mid-entry.
    it('accepts a number half in each script', () => {
      expect(normalizeBdPhone('০১7১১১২৩৪৫৬')).toBe(E164);
    });
  });

  it('still rejects what is genuinely not a BD mobile number', () => {
    expect(normalizeBdPhone('০১৭১১')).toBeNull(); // too short
    expect(normalizeBdPhone('০২৭১১১২৩৪৫৬')).toBeNull(); // not an 01 prefix
    expect(normalizeBdPhone('')).toBeNull();
    expect(normalizeBdPhone('not a phone')).toBeNull();
  });
});

describe('toAsciiDigits', () => {
  it('converts the Bengali digits and leaves everything else alone', () => {
    expect(toAsciiDigits('০১২৩৪৫৬৭৮৯')).toBe('0123456789');
    expect(toAsciiDigits('Flat ৫, Road ১২')).toBe('Flat 5, Road 12');
    expect(toAsciiDigits('already ascii 123')).toBe('already ascii 123');
  });

  // Same length in, same length out — which is why the input can rewrite the
  // field in place without the caret jumping.
  it('never changes the length of the string', () => {
    const input = '০১৭১১-১২৩৪৫৬';
    expect(toAsciiDigits(input)).toHaveLength(input.length);
  });
});
