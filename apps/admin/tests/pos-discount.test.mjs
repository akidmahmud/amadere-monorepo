import { test } from "node:test";
import assert from "node:assert/strict";
import { afterDiscount } from "../src/lib/pos-discount.ts";

test("owner's example: 100/200/400 with ৳10 off → 97/197/396", () => {
  assert.deepEqual(afterDiscount([100, 200, 400], 10), [97, 197, 396]);
});

test("equal split in whole taka; last line takes the rest", () => {
  assert.deepEqual(afterDiscount([80, 80], 10), [75, 75]);
  // 10% of 695 = 69.5 → 34 + 35.5
  assert.deepEqual(afterDiscount([300, 395], 69.5), [266, 359.5]);
});

test("no discount leaves lines unchanged", () => {
  assert.deepEqual(afterDiscount([50, 70], 0), [50, 70]);
});
