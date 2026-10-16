import { test } from "node:test";
import assert from "node:assert/strict";
import { returnLinesError } from "../src/lib/return-lines.ts";

const lines = [{ name: "Turmeric", quantity: 4, restock: 3, writeOff: 1 }];

test("a full return must account for every unit", () => {
  assert.equal(returnLinesError(lines, "RETURNED"), null);
  assert.match(returnLinesError([{ ...lines[0], writeOff: 0 }], "RETURNED"), /all 4/);
});

test("a partial return may keep some; never more than sold", () => {
  assert.equal(returnLinesError([{ ...lines[0], restock: 1, writeOff: 0 }], "PARTIALLY_RETURNED"), null);
  assert.match(returnLinesError([{ ...lines[0], restock: 4, writeOff: 1 }], "PARTIALLY_RETURNED"), /more than 4/);
});

test("negative numbers are refused", () => {
  assert.match(returnLinesError([{ ...lines[0], restock: -1, writeOff: 0 }], "PARTIALLY_RETURNED"), /negative/);
});

test("a partial return where nothing came back is refused", () => {
  assert.match(returnLinesError([{ ...lines[0], restock: 0, writeOff: 0 }], "PARTIALLY_RETURNED"), /nothing came back/i);
});

import { shelfWriteOffError } from "../src/lib/return-lines.ts";

test("stock already back: write off at most what is on the shelf, never less than before", () => {
  const l = { name: "Turmeric", prevOff: 1, onShelf: 3, writeOff: 2 };
  assert.equal(shelfWriteOffError([l]), null);
  assert.match(shelfWriteOffError([{ ...l, writeOff: 5 }]), /only 3 back in stock/);
  assert.match(shelfWriteOffError([{ ...l, writeOff: 0 }]), /already written off/);
});
