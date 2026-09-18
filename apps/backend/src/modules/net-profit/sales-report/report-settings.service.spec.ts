import { BadRequestException } from '@nestjs/common';
import {
  ReportSettingsService,
  validateSettings,
  zoneNames,
  zoneOf,
} from './report-settings.service';

const zones = {
  showOnCheckout: false,
  zones: [
    { name: { en: 'Inside Dhaka', bn: '' }, fee: 80, districts: ['Dhaka'] },
  ],
  fallback: { name: { en: 'Outside Dhaka', bn: '' }, fee: 120 },
};

describe('zoneOf', () => {
  it('matches districts case-insensitively even when zones are hidden at checkout', () => {
    expect(zoneOf(zones, 'dhaka')).toBe('Inside Dhaka');
    expect(zoneOf(zones, 'Rajshahi')).toBe('Outside Dhaka');
    expect(zoneOf(zones, null)).toBe('Outside Dhaka');
    expect(zoneNames(zones)).toEqual(['Inside Dhaka', 'Outside Dhaka']);
  });
});

describe('ReportSettingsService.get', () => {
  it('fills every courier × zone with the demo defaults', async () => {
    const svc = new ReportSettingsService(
      {
        getNamespace: jest
          .fn()
          .mockImplementation((_ns, d) => Promise.resolve(d)),
      } as never,
      { getConfig: jest.fn().mockResolvedValue(zones) } as never,
    );
    const s = await svc.get();
    expect(s.rates.STEADFAST.zones['Inside Dhaka']).toEqual({
      smallMax: 0.2,
      small: 80,
      first: 105,
      extra: 20,
    });
    expect(s.rates.PATHAO.zones['Outside Dhaka']).toBeDefined();
    expect(s.rates.STEADFAST).toMatchObject({
      cod: 1,
      codBase: 'product',
      returnPct: 100,
    });
    expect(s.th).toEqual({ low: 50, over: 5, pending: 2, bill: 3 });
  });
});

describe('validateSettings', () => {
  const ok = {
    rates: {
      STEADFAST: {
        cod: 1,
        codBase: 'product',
        returnPct: 100,
        zones: {
          'Inside Dhaka': { smallMax: 0.2, small: 80, first: 105, extra: 20 },
        },
      },
    },
    packaging: 0,
    fees: { BKASH: 1.5 },
    th: { low: 50, over: 5, pending: 2, bill: 3 },
  };
  it('accepts a valid payload', () =>
    expect(validateSettings(ok, ['STEADFAST'])).toEqual(ok));
  it('rejects negatives, unknown couriers and bad codBase', () => {
    expect(() =>
      validateSettings({ ...ok, packaging: -1 }, ['STEADFAST']),
    ).toThrow(BadRequestException);
    expect(() =>
      validateSettings({ ...ok, rates: { FOO: ok.rates.STEADFAST } }, [
        'STEADFAST',
      ]),
    ).toThrow(BadRequestException);
    expect(() =>
      validateSettings(
        {
          ...ok,
          rates: { STEADFAST: { ...ok.rates.STEADFAST, codBase: 'x' } },
        },
        ['STEADFAST'],
      ),
    ).toThrow(BadRequestException);
  });
});
