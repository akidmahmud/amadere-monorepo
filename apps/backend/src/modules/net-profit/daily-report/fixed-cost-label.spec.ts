import { fixedCostLabel } from '@amader/shared';

const c = (type: string, amount: number) =>
  ({ id: 'x', name: 'VAT', type, amount, value: 0 }) as never;

describe('fixedCostLabel', () => {
  it.each([
    ['PER_DAY', 500, 'VAT — ৳500 per day'],
    ['PER_MONTH', 30000, 'VAT — ৳30,000 per month (split by day)'],
    ['PERCENT_OF_SALES', 5, 'VAT — 5% of sales'],
    ['MARKETING_LEDGER', 0, 'VAT — from Marketing Cost entries'],
  ])('%s %s → %s', (type, amount, want) => {
    expect(fixedCostLabel(c(type, amount))).toBe(want);
  });
});
