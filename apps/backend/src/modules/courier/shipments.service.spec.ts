import { rawCourierStatus } from './shipments.service';

// The queue's courier-status label must only ever show a LIVE word. The
// create response carries `consignment.status`, which Steadfast always sets
// to "in_review" at creation and never rewrites — reading it painted
// "in review" under every row, delivered ones included.
describe('rawCourierStatus', () => {
  it('reads delivery_status from a track/status poll', () => {
    expect(rawCourierStatus({ status: 200, delivery_status: 'in_review' })).toBe('in_review');
    expect(rawCourierStatus({ status: 200, delivery_status: 'delivered' })).toBe('delivered');
  });

  it('ignores the create response, whose consignment.status is a stale snapshot', () => {
    expect(
      rawCourierStatus({
        status: 200,
        message: 'Consignment has been created successfully.',
        consignment: { consignment_id: 289628471, status: 'in_review' },
      }),
    ).toBeNull();
  });

  it('returns null rather than guessing when there is no live status', () => {
    expect(rawCourierStatus(null)).toBeNull();
    expect(rawCourierStatus('delivered')).toBeNull();
    expect(rawCourierStatus({ status: 400, message: 'Unauthorized' })).toBeNull();
    expect(rawCourierStatus({ delivery_status: 200 })).toBeNull();
  });
});
