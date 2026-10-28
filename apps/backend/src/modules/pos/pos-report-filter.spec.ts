import { filterReportRows } from './pos-reports.service';

// Report exports follow the filter on screen (owner, 2026-10-28): the
// "Expiring ≤15 days" pill exports those rows, not all 204.
describe('filterReportRows', () => {
  const rows = [
    { name: 'Ghee', sku: 'GHEE-1', status: 'Expired' },
    { name: 'Chatu', sku: 'CHT-1', status: 'Expiring soon' },
    { name: 'Rice', sku: 'RICE-5', status: 'OK' },
    { name: 'Salt', sku: null, status: 'No expiry' },
  ];
  const names = (status?: string, q?: string) =>
    filterReportRows(rows, status, q, ['name', 'sku']).map((r) => r.name);

  it('no status = all rows', () => expect(names()).toEqual(['Ghee', 'Chatu', 'Rice', 'Salt']));
  it('"alert" = expired + expiring soon', () => expect(names('alert')).toEqual(['Ghee', 'Chatu']));
  it('an exact status', () => expect(names('No expiry')).toEqual(['Salt']));
  it('search on name or SKU, combined with status', () => {
    expect(names(undefined, 'rice-5')).toEqual(['Rice']);
    expect(names('alert', 'gh')).toEqual(['Ghee']);
  });
});
