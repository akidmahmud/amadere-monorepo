import { BadRequestException } from '@nestjs/common';
import {
  DEFAULT_MAX_QTY_PER_ITEM,
  assertLineQuantity,
  lineLimit,
  parseStoreMax,
} from './quantity-limit';

// Guards the abuse seen in Recovery: a checkout-abandonment row with
// 1222 × honey (৳15.6 lakh) — the cart accepted any quantity because the
// change-quantity path had no check at all and every product's own
// maxOrderQuantity was blank (= unlimited).
describe('lineLimit', () => {
  it('is the store limit when the product sets none', () => {
    expect(lineLimit(null, 30)).toBe(30);
    expect(lineLimit(0, 30)).toBe(30);
  });
  it("is the product's own max when that is lower", () => {
    expect(lineLimit(5, 30)).toBe(5);
  });
  it('never lets a product raise the store limit', () => {
    expect(lineLimit(500, 30)).toBe(30);
  });
});

describe('assertLineQuantity', () => {
  it('allows up to the limit', () => {
    expect(() => assertLineQuantity(30, 30)).not.toThrow();
  });
  it('rejects the next unit with a message pointing bulk buyers elsewhere', () => {
    expect(() => assertLineQuantity(31, 30)).toThrow(BadRequestException);
    expect(() => assertLineQuantity(1222, 30)).toThrow(
      'You can order at most 30 of this item. For bulk orders please contact us.',
    );
  });
});

describe('parseStoreMax', () => {
  it('defaults to 30 when unset or invalid', () => {
    expect(DEFAULT_MAX_QTY_PER_ITEM).toBe(30);
    expect(parseStoreMax(undefined)).toBe(30);
    expect(parseStoreMax('abc')).toBe(30);
    expect(parseStoreMax(0)).toBe(30);
    expect(parseStoreMax(-4)).toBe(30);
    expect(parseStoreMax(2.5)).toBe(30);
  });
  it('accepts a positive whole number, stored as number or string', () => {
    expect(parseStoreMax(50)).toBe(50);
    expect(parseStoreMax('12')).toBe(12);
  });
});
