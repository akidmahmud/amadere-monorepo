import { test } from "node:test";
import assert from "node:assert/strict";
import { cellStyle, SHEET_COLORS as C } from "../src/components/net-profit/sales-report/sheetStyle.ts";

// Colours read from the owner's "Daily Sales Data.xlsx": column titles on dark
// green with white bold text; the courier block P–V (cols 15–21) on light blue
// with blue text, header and body alike; the group-label row above is plain.
const orders = { headerRows: 2, band: [15, 21] };

test("column titles: dark green, white, bold", () => {
  assert.deepEqual(cellStyle(1, 0, orders), { fill: C.head, color: C.headText, bold: true });
  assert.deepEqual(cellStyle(1, 25, orders), { fill: C.head, color: C.headText, bold: true });
});

test("courier block P–V: light blue with blue text, bold in the header", () => {
  assert.deepEqual(cellStyle(1, 15, orders), { fill: C.band, color: C.bandText, bold: true });
  assert.deepEqual(cellStyle(5, 21, orders), { fill: C.band, color: C.bandText });
});

test("group-label row is plain muted text; ordinary body cells are unstyled", () => {
  assert.deepEqual(cellStyle(0, 12, orders), { color: C.group, italic: true });
  assert.equal(cellStyle(5, 0, orders), null);
  assert.equal(cellStyle(5, 22, orders), null);
});

test("single-header tabs: one dark-green title row, no band", () => {
  assert.deepEqual(cellStyle(0, 3, { headerRows: 1 }), { fill: C.head, color: C.headText, bold: true });
  assert.equal(cellStyle(1, 3, { headerRows: 1 }), null);
});
