// Excel export colours, copied from the owner's "Daily Sales Data.xlsx" so the
// report's export looks like the sheet the shop already keeps. ARGB hex.
export const SHEET_COLORS = {
  head: "FF1F5C3F", // column titles: dark green
  headText: "FFFFFFFF",
  band: "FFDEEBF7", // courier block (P–V): light blue, header and body
  bandText: "FF4472C4",
  group: "FF64766B", // group-label row above the titles
  title: "FFE2EFDA", // report title row: pale green, as in the owner's sheets
} as const;

export interface SheetLayout {
  /** Rows at the top that are headers; the last one holds the column titles. */
  headerRows: number;
  /** Inclusive 0-based column range shaded as a block (the courier columns). */
  band?: [number, number];
}

export interface CellStyle {
  fill?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
}

/** Pure, so the colour rules are testable without Excel. 0-based row/col. */
export function cellStyle(
  row: number,
  col: number,
  layout: SheetLayout,
): CellStyle | null {
  const inBand =
    !!layout.band && col >= layout.band[0] && col <= layout.band[1];
  if (row < layout.headerRows - 1)
    return { color: SHEET_COLORS.group, italic: true };
  if (row === layout.headerRows - 1) {
    return inBand
      ? { fill: SHEET_COLORS.band, color: SHEET_COLORS.bandText, bold: true }
      : { fill: SHEET_COLORS.head, color: SHEET_COLORS.headText, bold: true };
  }
  return inBand
    ? { fill: SHEET_COLORS.band, color: SHEET_COLORS.bandText }
    : null;
}
