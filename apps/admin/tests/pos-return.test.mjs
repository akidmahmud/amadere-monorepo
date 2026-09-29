import { test } from "node:test";
import assert from "node:assert/strict";
import { refundEstimate } from "../src/lib/pos-return.ts";
import { daysAgo } from "../src/lib/pos-days.ts";

test("days ago counts calendar days", () => {
  const now = new Date(2026, 8, 30, 9, 0).getTime();
  assert.equal(daysAgo(new Date(2026, 8, 30, 1, 0), now), "Today");
  assert.equal(daysAgo(new Date(2026, 8, 29, 23, 0), now), "Yesterday");
  assert.equal(daysAgo(new Date(2026, 8, 25, 12, 0), now), "5 days ago");
});

// ৳120 of goods, ৳12 off → ৳108 paid.
const sale = { subTotal: "120", totalAmount: "108" };

test("one item refunds its share of what was paid", () => {
  assert.equal(refundEstimate(sale, [{ unitPrice: "50", qty: 1 }], false), 45);
});

test("the last return takes exactly what is left", () => {
  assert.equal(
    refundEstimate({ ...sale, posRefundedAmount: "90" }, [{ unitPrice: "20", qty: 1 }], true),
    18,
  );
});

test("nothing picked, nothing refunded", () => {
  assert.equal(refundEstimate(sale, [], false), 0);
});
