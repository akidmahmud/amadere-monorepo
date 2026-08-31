import { rawCourierStatus } from './shipments.service';

// Steadfast writes two different shapes into Shipment.rawResponse depending
// on which call touched the row last, and the queue's courier-status label
// is wrong (or blank) if either one is missed — the exact reason `in_review`
// went unnoticed for days.
describe('rawCourierStatus', () => {
  it('reads delivery_status from a track/status poll', () => {
    expect(rawCourierStatus({ status: 200, delivery_status: 'in_review' })).toBe('in_review');
  });

  it('reads consignment.status from the original create response', () => {
    expect(
      rawCourierStatus({
        status: 200,
        message: 'Consignment has been created successfully.',
        consignment: { consignment_id: 290371717, status: 'in_review' },
      }),
    ).toBe('in_review');
  });

  it('prefers the poll value when a row carries both', () => {
    expect(
      rawCourierStatus({ delivery_status: 'delivered', consignment: { status: 'in_review' } }),
    ).toBe('delivered');
  });

  it('returns null rather than guessing when there is no status', () => {
    expect(rawCourierStatus(null)).toBeNull();
    expect(rawCourierStatus('in_review')).toBeNull();
    expect(rawCourierStatus({ status: 400, message: 'Unauthorized' })).toBeNull();
    expect(rawCourierStatus({ consignment: { status: 200 } })).toBeNull();
  });
});
