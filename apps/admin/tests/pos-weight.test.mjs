import { test } from "node:test";
import assert from "node:assert/strict";
import { formatWeight, fromBase, toBase, unitFor, lineSize } from "../src/lib/pos-weight.ts";

test("g/ml are thousandths of the stored kg/L", () => {
  assert.equal(toBase(500, "g"), 0.5);
  assert.equal(toBase(750, "ml"), 0.75);
  assert.equal(toBase(1.5, "l"), 1.5);
  assert.equal(fromBase(0.25, "ml"), 250);
});

test("labels use the chosen unit; with none, g below 1 kg else kg", () => {
  assert.equal(formatWeight("0.5", "ml"), "500 ml");
  assert.equal(formatWeight(1.5, "l"), "1.5 L");
  assert.equal(formatWeight(2, "kg"), "2 kg");
  assert.equal(formatWeight("0.5"), "500 g");
  assert.equal(formatWeight(1.25), "1.25 kg");
  assert.equal(formatWeight(null), null);
  assert.equal(unitFor(0.2, "bogus"), "g");
});

test("line size: weight alone, size label alone, or both when the store set its own", () => {
  assert.equal(lineSize({ weightKg: "0.5", weightUnit: "g" }), "500 g");
  assert.equal(lineSize({ variantLabel: "1KG", weightKg: "1" }), "1KG");
  assert.equal(lineSize({ variantLabel: "1KG", weightKg: "1.5", weightUnit: "l", storeWeight: true }), "1KG · 1.5 L");
  assert.equal(lineSize({}), "");
});
