import { BadRequestException } from '@nestjs/common';
import {
  assertBarcode,
  ean13CheckDigit,
  internalBarcode,
  isValidEan13,
} from './barcode.util';

describe('EAN-13', () => {
  it('computes the check digit', () => {
    expect(ean13CheckDigit('590123412345')).toBe(7); // 5901234123457
    expect(ean13CheckDigit('400638133393')).toBe(1); // 4006381333931
  });

  it('validates', () => {
    expect(isValidEan13('5901234123457')).toBe(true);
    expect(isValidEan13('5901234123458')).toBe(false);
    expect(isValidEan13('59012341234')).toBe(false);
    expect(isValidEan13('59012341234a7')).toBe(false);
  });
});

describe('internalBarcode', () => {
  it('is unique per SKU and stable', () => {
    expect(internalBarcode(12, null)).toBe('2000012000003');
    expect(internalBarcode(12, 3)).not.toBe(internalBarcode(123, null));
    expect(internalBarcode(12, 3)).toBe(internalBarcode(12, 3));
  });

  it('is a valid in-store EAN-13 ("2" prefix)', () => {
    for (const [p, v] of [[12, null], [91, 246], [999999, 99999]] as const) {
      const code = internalBarcode(p, v);
      expect(code).toMatch(/^2\d{12}$/);
      expect(isValidEan13(code)).toBe(true);
    }
    expect(internalBarcode(91, 246).slice(0, 12)).toBe('200009100246');
  });
});

describe('assertBarcode', () => {
  it('rejects a 13-digit code with a wrong check digit (typo on a manufacturer barcode)', () => {
    expect(() => assertBarcode('5901234123458')).toThrow(BadRequestException);
  });
  it('accepts valid EAN-13, internal codes, and empty', () => {
    expect(() => assertBarcode('5901234123457')).not.toThrow();
    expect(() => assertBarcode('AMD00001200000')).not.toThrow();
    expect(() => assertBarcode(null)).not.toThrow();
    expect(() => assertBarcode(undefined)).not.toThrow();
  });
});
