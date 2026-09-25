import { test } from "node:test";
import assert from "node:assert/strict";
import { orderTaxView } from "../src/lib/order-tax.ts";

const base = { discountAmount: "0", codFee: "0", shippingAmount: "0" };

test("VAT added on top: rows add up, rate from the pre-VAT base", () => {
  const v = orderTaxView({ ...base, subTotal: "1000", taxAmount: "150", totalAmount: "1150" });
  assert.deepEqual(v, { included: false, ratePercent: 15, displayDiscount: 0 });
});

test("VAT included in the price (POS inclusive mode): flagged, rate from the VAT-inclusive base", () => {
  const v = orderTaxView({ ...base, subTotal: "1000", taxAmount: "47.62", totalAmount: "1000" });
  assert.equal(v.included, true);
  assert.equal(v.ratePercent, 5);
});

test("no tax", () => {
  assert.deepEqual(orderTaxView({ ...base, subTotal: "500", taxAmount: "0", totalAmount: "500" }), {
    included: false,
    ratePercent: null,
    displayDiscount: 0,
  });
});
