import { test } from "node:test";
import assert from "node:assert/strict";
import { canActFor } from "../src/lib/pos-transfer.ts";

test("store staff act for their own store only", () => {
  assert.equal(canActFor({ allStores: false, myStoreId: 2 }, 2), true);
  assert.equal(canActFor({ allStores: false, myStoreId: 2 }, 3), false);
});

test("all-stores users act for any store", () => {
  assert.equal(canActFor({ allStores: true, myStoreId: undefined }, 3), true);
});

test("no store = no action", () => {
  assert.equal(canActFor({ allStores: false, myStoreId: undefined }, 3), false);
});

import { defaultCostCentre } from "../src/lib/pos-transfer.ts";

test("expense form: default cost centre is the user's store's", () => {
  const stores = [{ id: 1, costCentreId: null }, { id: 2, costCentreId: 9 }];
  assert.equal(defaultCostCentre(2, stores), "9");
  assert.equal(defaultCostCentre(1, stores), ""); // store without a cost centre
  assert.equal(defaultCostCentre(null, stores), ""); // no home store
  assert.equal(defaultCostCentre(3, stores), ""); // unknown store
});
