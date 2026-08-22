import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateShippingZonesDto } from './update-shipping-zones.dto';
import { SHIPPING_ZONES_DEFAULTS } from '../shipping-zones.defaults';

// Matches the app's global pipe in main.ts (whitelist, no
// forbidNonWhitelisted) so this harness cannot assert behaviour production
// does not have.
function validate(payload: unknown) {
  return validateSync(plainToInstance(UpdateShippingZonesDto, payload), { whitelist: true });
}

function clone() {
  return JSON.parse(JSON.stringify(SHIPPING_ZONES_DEFAULTS));
}

describe('UpdateShippingZonesDto', () => {
  it('accepts the shipped defaults', () => {
    expect(validate(SHIPPING_ZONES_DEFAULTS)).toHaveLength(0);
  });

  it('rejects an unknown district name', () => {
    const p = clone();
    p.zones[0].districts = ['Dhaka', 'Nowhereville'];
    expect(validate(p).length).toBeGreaterThan(0);
  });

  it('rejects the same district in two zones', () => {
    const p = clone();
    p.zones.push({ name: { en: 'Dup', bn: 'Dup' }, fee: 90, districts: ['Dhaka'] });
    expect(validate(p).length).toBeGreaterThan(0);
  });

  it('rejects a negative fee', () => {
    const p = clone();
    p.zones[0].fee = -1;
    expect(validate(p).length).toBeGreaterThan(0);
  });

  it('accepts a zero fee (free delivery zone)', () => {
    const p = clone();
    p.zones[0].fee = 0;
    expect(validate(p)).toHaveLength(0);
  });

  it('rejects an empty zone list', () => {
    const p = clone();
    p.zones = [];
    expect(validate(p).length).toBeGreaterThan(0);
  });

  it('rejects a zone name missing its bn key', () => {
    const p = clone();
    p.zones[0].name = { en: 'Inside Dhaka' };
    expect(validate(p).length).toBeGreaterThan(0);
  });

  it('accepts a district whose casing differs from the canonical list', () => {
    const p = clone();
    p.zones[0].districts = ['dhaka'];
    expect(validate(p)).toHaveLength(0);
  });
});
