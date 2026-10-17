import { test } from "node:test";
import assert from "node:assert/strict";
import { findGramsValue, gramsLabel, labelToKg } from "../src/lib/variant-weight.ts";

test("labels convert to kg", () => {
  assert.equal(labelToKg("500 gram"), 0.5);
  assert.equal(labelToKg("1KG"), 1);
  assert.equal(labelToKg("10kg"), 10);
  assert.equal(labelToKg("2 Ltr"), 2);
  assert.equal(labelToKg("500 ML"), 0.5);
  assert.equal(labelToKg("Red"), null);
});

test("custom grams get a label and reuse an equal value", () => {
  assert.equal(gramsLabel(750), "750 gram");
  assert.equal(gramsLabel(1500), "1.5KG");
  const values = [{ label: "1 Ltr" }, { label: "1KG" }, { label: "500 gram" }];
  assert.equal(findGramsValue(values, 1000)?.label, "1KG");
  assert.equal(findGramsValue(values, 500)?.label, "500 gram");
  assert.equal(findGramsValue(values, 750), undefined);
});
