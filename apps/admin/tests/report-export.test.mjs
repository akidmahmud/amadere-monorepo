import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, reportTitle, toCell } from "../src/lib/reportTitle.ts";

test("title: single day, range, times, and no range", () => {
  assert.equal(
    reportTitle("Sales Report", { from: "2026-08-18", to: "2026-08-18" }),
    "Amader eBuy Limited - Aug 18, 2026 - Sales Report",
  );
  assert.equal(
    reportTitle("Sales Report", { from: "2026-08-18", to: "2026-08-18", fromTime: "09:00", toTime: "12:00" }),
    "Amader eBuy Limited - Aug 18, 2026 09:00 to 12:00 - Sales Report",
  );
  assert.equal(
    reportTitle("Retail Orders", { from: "2026-08-12", to: "2026-08-18" }),
    "Amader eBuy Limited - Aug 12, 2026 to Aug 18, 2026 - Retail Orders",
  );
  // The customers filter sends datetime-local values.
  assert.equal(
    reportTitle("Retail Customers", { from: "2026-08-12T10:30", to: "2026-08-18T18:00" }),
    "Amader eBuy Limited - Aug 12, 2026 10:30 to Aug 18, 2026 18:00 - Retail Customers",
  );
  assert.equal(
    reportTitle("Wholesale Customers", {}, new Date("2026-09-18T20:00:00Z")),
    "Amader eBuy Limited - Sep 19, 2026 - Wholesale Customers", // 02:00 next day in Dhaka
  );
});

test("csv: BOM, quotes, escaped quotes, embedded comma and newline, CRLF", () => {
  const csv = '﻿Name,Note,Total\r\n"Shop, Ltd","said ""hi""\nthen left",450\r\nA,,12.5\r\n';
  assert.deepEqual(parseCsv(csv), [
    ["Name", "Note", "Total"],
    ["Shop, Ltd", 'said "hi"\nthen left', "450"],
    ["A", "", "12.5"],
  ]);
});

test("cells: amounts become numbers, phones and zero-led codes stay text", () => {
  assert.equal(toCell("450"), 450);
  assert.equal(toCell("-12.50"), -12.5);
  assert.equal(toCell("8801768283024"), "8801768283024");
  assert.equal(toCell("01840193060"), "01840193060");
  assert.equal(toCell("ORD-1"), "ORD-1");
  assert.equal(toCell(""), "");
});
