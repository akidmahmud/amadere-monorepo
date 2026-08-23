import {
  computeExpenseAmounts, ageingBucket, toPaisa, fromPaisa,
} from '@amader/shared';

describe('accounts-math', () => {
  describe('toPaisa / fromPaisa', () => {
    it('round-trips a 2dp amount', () => {
      expect(toPaisa('1234.56')).toBe(123456);
      expect(fromPaisa(123456)).toBe('1234.56');
    });

    it('handles amounts with no decimal part', () => {
      expect(toPaisa(1000)).toBe(100000);
      expect(fromPaisa(100000)).toBe('1000.00');
    });

    it('rounds a third decimal place half-up', () => {
      expect(toPaisa('10.005')).toBe(1001);
    });
  });

  describe('computeExpenseAmounts — VAT exclusive', () => {
    it('adds VAT on top of the typed amount', () => {
      const r = computeExpenseAmounts({
        amount: toPaisa(1000), amountIncludesVat: false,
        vatRate: 1500, aitPercent: 0, vdsPercent: 0,
      });
      expect(fromPaisa(r.netAmount)).toBe('1000.00');
      expect(fromPaisa(r.vatAmount)).toBe('150.00');
      expect(fromPaisa(r.grossAmount)).toBe('1150.00');
      expect(fromPaisa(r.netPayable)).toBe('1150.00');
    });
  });

  describe('computeExpenseAmounts — VAT inclusive (defect D4)', () => {
    it('extracts VAT from within the typed amount, not on top of it', () => {
      const r = computeExpenseAmounts({
        amount: toPaisa(1150), amountIncludesVat: true,
        vatRate: 1500, aitPercent: 0, vdsPercent: 0,
      });
      expect(fromPaisa(r.grossAmount)).toBe('1150.00');
      expect(fromPaisa(r.netAmount)).toBe('1000.00');
      expect(fromPaisa(r.vatAmount)).toBe('150.00');
    });

    it('never lets net + vat drift from gross when the division is inexact', () => {
      const r = computeExpenseAmounts({
        amount: toPaisa('1000.00'), amountIncludesVat: true,
        vatRate: 1500, aitPercent: 0, vdsPercent: 0,
      });
      expect(r.netAmount + r.vatAmount).toBe(r.grossAmount);
    });

    it('handles a 7.5% rate', () => {
      const r = computeExpenseAmounts({
        amount: toPaisa(1075), amountIncludesVat: true,
        vatRate: 750, aitPercent: 0, vdsPercent: 0,
      });
      expect(fromPaisa(r.netAmount)).toBe('1000.00');
      expect(fromPaisa(r.vatAmount)).toBe('75.00');
    });

    it('treats a 0% rate as all-net', () => {
      const r = computeExpenseAmounts({
        amount: toPaisa(500), amountIncludesVat: true,
        vatRate: 0, aitPercent: 0, vdsPercent: 0,
      });
      expect(fromPaisa(r.netAmount)).toBe('500.00');
      expect(fromPaisa(r.vatAmount)).toBe('0.00');
    });
  });

  describe('withholding', () => {
    it('deducts AIT from the net/base value', () => {
      const r = computeExpenseAmounts({
        amount: toPaisa(1000), amountIncludesVat: false,
        vatRate: 1500, aitPercent: 500, vdsPercent: 0,
      });
      expect(fromPaisa(r.aitAmount)).toBe('50.00');
      expect(fromPaisa(r.netPayable)).toBe('1100.00'); // 1150 gross - 50 AIT
    });

    it('deducts VDS as a share of the VAT, not of the base', () => {
      const r = computeExpenseAmounts({
        amount: toPaisa(1000), amountIncludesVat: false,
        vatRate: 1500, aitPercent: 0, vdsPercent: 10000, // full VAT withheld
      });
      expect(fromPaisa(r.vdsAmount)).toBe('150.00');
      expect(fromPaisa(r.netPayable)).toBe('1000.00');
    });

    it('withholds one third of the VAT at 3333bp', () => {
      const r = computeExpenseAmounts({
        amount: toPaisa(1000), amountIncludesVat: false,
        vatRate: 1500, aitPercent: 0, vdsPercent: 3333,
      });
      expect(fromPaisa(r.vdsAmount)).toBe('50.00'); // 150.00 / 3
    });

    it('applies AIT and VDS together', () => {
      const r = computeExpenseAmounts({
        amount: toPaisa(1000), amountIncludesVat: false,
        vatRate: 1500, aitPercent: 500, vdsPercent: 10000,
      });
      expect(fromPaisa(r.netPayable)).toBe('950.00'); // 1150 - 50 - 150
    });
  });

  describe('guards', () => {
    it('rejects a negative amount', () => {
      expect(() => computeExpenseAmounts({
        amount: -1, amountIncludesVat: false,
        vatRate: 0, aitPercent: 0, vdsPercent: 0,
      })).toThrow(/negative/i);
    });

    it('rejects a non-integer paisa amount', () => {
      expect(() => computeExpenseAmounts({
        amount: 10.5, amountIncludesVat: false,
        vatRate: 0, aitPercent: 0, vdsPercent: 0,
      })).toThrow(/integer/i);
    });
  });

  describe('ageingBucket', () => {
    const asOf = new Date('2026-08-23T00:00:00Z');
    const d = (s: string) => new Date(`${s}T00:00:00Z`);

    it('treats a missing due date as current', () => {
      expect(ageingBucket(null, asOf)).toBe('CURRENT');
    });
    it('treats a future due date as current', () => {
      expect(ageingBucket(d('2026-09-01'), asOf)).toBe('CURRENT');
    });
    it('treats the due date itself as current', () => {
      expect(ageingBucket(d('2026-08-23'), asOf)).toBe('CURRENT');
    });
    it('buckets one day overdue as 1_30', () => {
      expect(ageingBucket(d('2026-08-22'), asOf)).toBe('1_30');
    });
    it('buckets exactly 30 days overdue as 1_30', () => {
      expect(ageingBucket(d('2026-07-24'), asOf)).toBe('1_30');
    });
    it('buckets 31 days overdue as 31_60', () => {
      expect(ageingBucket(d('2026-07-23'), asOf)).toBe('31_60');
    });
    it('buckets exactly 60 days overdue as 31_60', () => {
      expect(ageingBucket(d('2026-06-24'), asOf)).toBe('31_60');
    });
    it('buckets 61 days overdue as 60_PLUS', () => {
      expect(ageingBucket(d('2026-06-23'), asOf)).toBe('60_PLUS');
    });
  });
});
