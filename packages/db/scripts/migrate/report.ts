export interface TableCount {
  source: number;
  migrated: number;
  skipped: number;
}

export interface MigrationReport {
  counts: Record<string, TableCount>;
  addressesDefaulted: { model: string; legacyId: number; addressLine: string }[];
  reviewsUnmatched: { legacyReviewId: number; customerLegacyId: number; productLegacyId: number }[];
  posPaymentsMappedToCod: number;
  redirectsCreated: number;
  redirectsSkippedAlreadyMatching: number;
  notes: string[];
}

export function createReport(): MigrationReport {
  return {
    counts: {},
    addressesDefaulted: [],
    reviewsUnmatched: [],
    posPaymentsMappedToCod: 0,
    redirectsCreated: 0,
    redirectsSkippedAlreadyMatching: 0,
    notes: [],
  };
}

export function bump(
  report: MigrationReport,
  table: string,
  field: keyof TableCount,
  by = 1,
): void {
  report.counts[table] ??= { source: 0, migrated: 0, skipped: 0 };
  report.counts[table][field] += by;
}
