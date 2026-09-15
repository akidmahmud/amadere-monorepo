export class CustomerImportSkippedRowDto {
  /** Spreadsheet row number, as shown in Excel. */
  row!: number;
  reason!: string;
}

export class CustomerImportResultDto {
  /** True when nothing was written — a preview of what Import would do. */
  dryRun!: boolean;
  totalRows!: number;
  /** New customers (created, or that would be created on a dry run). */
  created!: number;
  /** Existing customers that got previously-empty fields filled. */
  updated!: number;
  /** Existing customers with nothing new to add. */
  unchanged!: number;
  skipped!: number;
  /** First 100 skipped rows with the reason. */
  skippedRows!: CustomerImportSkippedRowDto[];
  /** Things imported with a caveat, e.g. an "Assign to" name with no staff account. */
  warnings!: string[];
}
