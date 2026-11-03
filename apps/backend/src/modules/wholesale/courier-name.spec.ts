import { courierNameFor, knownCourier } from './wholesale.service';

describe('courierNameFor', () => {
  it('keeps a typed name only for "Other", trimmed', () => {
    expect(courierNameFor('OTHER', '  Janani Courier ')).toBe('Janani Courier');
    expect(courierNameFor('OTHER', '   ')).toBeNull();
    expect(courierNameFor('SUNDARBAN', 'Janani Courier')).toBeNull();
    expect(courierNameFor(undefined, 'x')).toBeNull();
  });
});

describe('knownCourier', () => {
  it('maps a typed name of one of our couriers to that courier', () => {
    expect(knownCourier('OTHER', 'steadfast')).toBe('STEADFAST');
    expect(knownCourier('OTHER', ' Steadfast Courier ')).toBe('STEADFAST');
    expect(knownCourier('OTHER', 'S.A. Paribahan')).toBe('SA_PARIBAHAN');
    expect(knownCourier('OTHER', 'Janani Courier')).toBe('OTHER');
    expect(knownCourier('AJR', 'steadfast')).toBe('AJR');
    expect(knownCourier(undefined, null)).toBeUndefined();
  });
});
