import { test } from "node:test";
import assert from "node:assert/strict";
import { cartReducer, cartSubtotal, cartCount } from "../src/lib/pos-cart.ts";

const coke = { productId: 1, variantId: null, name: "Coca-Cola", price: "40.00", salePrice: null, stock: 3 };

test("add merges same SKU and caps at stock", () => {
  let c = cartReducer([], { type: "add", product: coke });
  c = cartReducer(c, { type: "add", product: coke });
  assert.equal(c.length, 1);
  assert.equal(c[0].qty, 2);
  c = cartReducer(c, { type: "setQty", key: "1:0", qty: 99 });
  assert.equal(c[0].qty, 3);
});

test("setQty 0 removes; sale price wins", () => {
  let c = cartReducer([], { type: "add", product: { ...coke, salePrice: "35.00" } });
  assert.equal(cartSubtotal(c), 35);
  c = cartReducer(c, { type: "setQty", key: "1:0", qty: 0 });
  assert.equal(c.length, 0);
});

test("out of stock is not added", () => {
  const c = cartReducer([], { type: "add", product: { ...coke, stock: 0 } });
  assert.equal(c.length, 0);
});

test("variants are separate lines; count sums quantities", () => {
  let c = cartReducer([], { type: "add", product: { ...coke, productId: 2, variantId: 5 } });
  c = cartReducer(c, { type: "add", product: { ...coke, productId: 2, variantId: 6 } });
  c = cartReducer(c, { type: "add", product: coke });
  c = cartReducer(c, { type: "add", product: coke });
  assert.equal(c.length, 3);
  assert.equal(cartCount(c), 4);
});

import { parseQtyInput } from "../src/lib/pos-cart.ts";

test("qty box: emptying the field keeps the current qty; digits parse", () => {
  assert.equal(parseQtyInput("", 3), 3);
  assert.equal(parseQtyInput("  ", 3), 3);
  assert.equal(parseQtyInput("5", 3), 5);
  assert.equal(parseQtyInput("0", 3), 3); // only × or − removes a line (spec 12.4.9)
  assert.equal(parseQtyInput("abc", 3), 3);
});
