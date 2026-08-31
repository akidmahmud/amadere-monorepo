import { withSingleDefault } from './products.service';

// "Exactly one default variant per product" is assumed by every read path —
// `variants.find(v => v.isDefault) ?? variants[0]` — so two defaults means the
// card, the PDP and the catalog feed can price from a different variant than
// the admin sees selected.
describe('withSingleDefault', () => {
  it('keeps only the first variant that claims the default', () => {
    const result = withSingleDefault([
      { name: 'a', isDefault: false },
      { name: 'b', isDefault: true },
      { name: 'c', isDefault: true },
    ]);
    expect(result.map((v) => v.isDefault)).toEqual([false, true, false]);
  });

  it('falls back to the first variant when none claims it', () => {
    const result = withSingleDefault([
      { name: 'a', isDefault: false },
      { name: 'b', isDefault: false },
    ]);
    expect(result.map((v) => v.isDefault)).toEqual([true, false]);
  });

  it('treats a missing isDefault the same as false', () => {
    const result = withSingleDefault([{ name: 'a' }, { name: 'b' }]);
    expect(result.map((v) => v.isDefault)).toEqual([true, false]);
  });

  it('leaves an already-correct array alone', () => {
    const result = withSingleDefault([
      { name: 'a', isDefault: true },
      { name: 'b', isDefault: false },
    ]);
    expect(result.map((v) => v.isDefault)).toEqual([true, false]);
  });

  it('handles an empty array', () => {
    expect(withSingleDefault([])).toEqual([]);
  });
});
