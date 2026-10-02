import { allSourceDefs, resolveSources, validateSettings } from './settings';

describe('allSourceDefs', () => {
  it('slots every wholesale channel (active or not) before OTHER', () => {
    const keys = allSourceDefs([
      { id: 3, name: 'Cash Sale' },
      { id: 9, name: 'Daraz' },
    ]).map((d) => d.key);
    expect(keys.slice(-3)).toEqual(['WCH_3', 'WCH_9', 'OTHER']);
    expect(keys[0]).toBe('WEB_DIRECT');
  });
});

describe('allSourceDefs — stores', () => {
  it('one "Shop – <name>" source per store, right after the generic shop', () => {
    const defs = allSourceDefs(
      [],
      [
        { id: 2, name: 'Banani' },
        { id: 5, name: 'Mirpur' },
      ],
    );
    const i = defs.findIndex((d) => d.key === 'SHOP');
    expect(defs.slice(i, i + 3)).toEqual([
      { key: 'SHOP', label: 'Shop sale' },
      { key: 'SHOP_2', label: 'Shop – Banani' },
      { key: 'SHOP_5', label: 'Shop – Mirpur' },
    ]);
  });
});

describe('resolveSources', () => {
  const defs = [
    { key: 'A', label: 'Alpha' },
    { key: 'B', label: 'Beta' },
    { key: 'C', label: 'Gamma' },
  ];
  it('uses stored order, drops unknown keys, appends new ones enabled', () => {
    expect(
      resolveSources(
        [
          { key: 'C', enabled: false },
          { key: 'GONE', enabled: true },
          { key: 'A', enabled: true },
        ],
        defs,
      ),
    ).toEqual([
      { key: 'C', enabled: false, label: 'Gamma' },
      { key: 'A', enabled: true, label: 'Alpha' },
      { key: 'B', enabled: true, label: 'Beta' },
    ]);
  });
  it('empty stored → defaults, all enabled', () => {
    expect(resolveSources([], defs).map((s) => s.enabled)).toEqual([
      true,
      true,
      true,
    ]);
  });
});

describe('validateSettings', () => {
  const ok = {
    autoEnabled: true,
    sources: [{ key: 'SHOP', enabled: false, label: 'ignored extra field' }],
    fixedCosts: [
      {
        id: 'a',
        name: ' VAT ',
        type: 'PERCENT_OF_SALES',
        amount: 5,
        scope: 'REPORT',
        active: true,
      },
      {
        id: 'b',
        name: 'Rent',
        type: 'PER_MONTH',
        amount: 30000,
        scope: 'SOURCE',
        sourceKey: 'SHOP',
        active: true,
      },
    ],
  };
  it('accepts valid input and strips extras / trims names', () => {
    expect(validateSettings(ok)).toEqual({
      autoEnabled: true,
      sources: [{ key: 'SHOP', enabled: false }],
      fixedCosts: [
        {
          id: 'a',
          name: 'VAT',
          type: 'PERCENT_OF_SALES',
          amount: 5,
          scope: 'REPORT',
          active: true,
        },
        {
          id: 'b',
          name: 'Rent',
          type: 'PER_MONTH',
          amount: 30000,
          scope: 'SOURCE',
          sourceKey: 'SHOP',
          active: true,
        },
      ],
    });
  });
  const cost = (patch: object) => ({
    ...ok,
    fixedCosts: [{ ...ok.fixedCosts[0], ...patch }],
  });
  it.each([
    [null, 'Settings must be an object.'],
    [{ ...ok, autoEnabled: 'yes' }, 'autoEnabled must be true or false.'],
    [{ ...ok, sources: [{ key: 1, enabled: true }] }, 'Source #1 is invalid.'],
    [cost({ name: '  ' }), 'Fixed cost #1 needs a name.'],
    [cost({ type: 'WEEKLY' }), 'Fixed cost #1 has an unknown type.'],
    [cost({ amount: -1 }), 'Fixed cost #1 amount must be 0 or more.'],
    [cost({ amount: 101 }), 'Fixed cost #1 percent must be 100 or less.'],
    [cost({ scope: 'SOURCE' }), 'Fixed cost #1 must name its source.'],
    [
      {
        ...ok,
        fixedCosts: [ok.fixedCosts[0], { ...ok.fixedCosts[1], id: 'a' }],
      },
      'Fixed cost #2 has a duplicate id.',
    ],
  ])('rejects %j', (input, msg) => {
    expect(() => validateSettings(input)).toThrow(msg);
  });
});
