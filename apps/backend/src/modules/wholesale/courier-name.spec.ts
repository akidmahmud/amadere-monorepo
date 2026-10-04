import { courierNameFor } from './wholesale.service';

describe('courierNameFor', () => {
  it('keeps a typed name only for "Other", trimmed', () => {
    expect(courierNameFor('OTHER', '  Janani Courier ')).toBe('Janani Courier');
    expect(courierNameFor('OTHER', '   ')).toBeNull();
    expect(courierNameFor('SUNDARBAN', 'Janani Courier')).toBeNull();
    expect(courierNameFor(undefined, 'x')).toBeNull();
  });
});
