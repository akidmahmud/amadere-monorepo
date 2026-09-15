import { BadRequestException } from '@nestjs/common';
import { channelFieldsOf, normalizeChannelFields, validateChannelValues } from './wholesale-channel-fields';

describe('wholesale channel fields', () => {
  it('gives every field a stable key and keeps existing ones', () => {
    const fields = normalizeChannelFields([
      { label: ' Order ID / Reference ', type: 'text', required: true, showInTable: true },
      { label: 'Order ID / Reference', type: 'number' },
      { key: 'gp_number', label: 'Voucher No (renamed)', type: 'text' },
    ]);
    expect(fields.map((f) => f.key)).toEqual(['order_id_reference', 'order_id_reference_2', 'gp_number']);
    expect(fields[0]).toMatchObject({ label: 'Order ID / Reference', required: true, showInTable: true });
    expect(fields[1]).toMatchObject({ required: false, showInTable: false });
  });

  it('refuses a dropdown with no options', () => {
    expect(() => normalizeChannelFields([{ label: 'Store', type: 'select', options: [' ', ''] }])).toThrow(BadRequestException);
    expect(normalizeChannelFields([{ label: 'Store', type: 'select', options: ['A', 'A', ' B '] }])[0].options).toEqual(['A', 'B']);
  });

  const fields = normalizeChannelFields([
    { label: 'Daraz Order ID', type: 'text', required: true, showInTable: true },
    { label: 'Commission', type: 'number' },
    { label: 'Settled On', type: 'date' },
    { label: 'Store', type: 'select', options: ['Main', 'Outlet'] },
  ]);

  it('stores typed values for known keys only and builds a search string', () => {
    const { values, search } = validateChannelValues(fields, {
      daraz_order_id: ' DZ-1001 ', commission: '12.5', settled_on: '2026-09-16', store: 'Outlet', unknown: 'x',
    });
    expect(values).toEqual({ daraz_order_id: 'DZ-1001', commission: 12.5, settled_on: '2026-09-16', store: 'Outlet' });
    expect(search).toBe('DZ-1001 12.5 2026-09-16 Outlet');
  });

  it('refuses a missing required value and wrong types', () => {
    expect(() => validateChannelValues(fields, {})).toThrow('Daraz Order ID is required');
    expect(() => validateChannelValues(fields, { daraz_order_id: 'x', commission: 'abc' })).toThrow('Commission must be a number');
    expect(() => validateChannelValues(fields, { daraz_order_id: 'x', settled_on: '16/09/2026' })).toThrow('Settled On must be a date');
    expect(() => validateChannelValues(fields, { daraz_order_id: 'x', store: 'Other' })).toThrow('Store must be one of');
  });

  it('drops empty optional values', () => {
    expect(validateChannelValues(fields, { daraz_order_id: 'x', commission: '', store: null })).toEqual({ values: { daraz_order_id: 'x' }, search: 'x' });
  });

  it('reads the JSON column defensively', () => {
    expect(channelFieldsOf(null)).toEqual([]);
    expect(channelFieldsOf([{ key: 'a', label: 'A' }, null, 3])).toHaveLength(1);
  });
});
