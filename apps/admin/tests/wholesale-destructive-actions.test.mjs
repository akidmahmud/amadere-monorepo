import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const component = (name) =>
  new URL(`../src/app/(shell)/wholesale/_components/${name}`, import.meta.url);

test("Wholesale orders expose the existing safe cancellation flow", async () => {
  const source = await readFile(component("OrdersDashboard.tsx"), "utf8");

  assert.match(source, /useCancelWholesaleOrder/);
  assert.match(source, /useCan\("wholesale\.delete"\)/);
  assert.match(source, /ConfirmDialog/);
  assert.doesNotMatch(source, /window\.confirm/);
  assert.match(source, /Delete Order/);
  assert.match(source, /Deleted Orders/);
  assert.match(source, /return to stock|restock/i);
});

test("Wholesale customers expose soft deletion in list and detail views", async () => {
  const dashboard = await readFile(component("CustomersDashboard.tsx"), "utf8");
  const table = await readFile(
    component("WholesaleCustomersTable.tsx"),
    "utf8",
  );
  const source = `${dashboard}\n${table}`;

  assert.match(source, /useDeleteWholesaleCustomer/);
  assert.match(source, /useCan\("wholesale\.delete"\)/);
  assert.match(dashboard, /ConfirmDialog/);
  assert.doesNotMatch(dashboard, /window\.confirm/);
  assert.match(source, /Delete Customer/);
  assert.match(source, /soft-delete|accounting history/i);
});

test("Wholesale customer restoration uses a styled confirmation dialog", async () => {
  const source = await readFile(
    component("DeletedWholesaleCustomers.tsx"),
    "utf8",
  );

  assert.match(source, /ConfirmDialog/);
  assert.doesNotMatch(source, /window\.confirm/);
  assert.match(source, /Restore Customer/);
});
