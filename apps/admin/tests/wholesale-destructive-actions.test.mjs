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

test("Wholesale orders expose preset and custom placed-at time filters", async () => {
  const dashboard = await readFile(component("OrdersDashboard.tsx"), "utf8");
  const hooks = await readFile(
    new URL("../src/hooks/useWholesale.ts", import.meta.url),
    "utf8",
  );

  assert.match(dashboard, /Last 1 hour/);
  assert.match(dashboard, /Last 30 days/);
  assert.match(dashboard, /type="datetime-local"/);
  assert.match(hooks, /params\.set\("from"/);
  assert.match(hooks, /params\.set\("to"/);
});

// Owner asked (2026-09-18) for solid deep tones instead of pastel tints:
// deep green for paid/channel, with deep amber, rose and slate alongside.
test("Wholesale badges use the solid deep-tone palette", async () => {
  const source = await readFile(component("OrdersDashboard.tsx"), "utf8");

  assert.doesNotMatch(source, /bg-emerald-500\/15/);
  assert.doesNotMatch(source, /bg-brand-500\/15/);
  assert.match(source, /green: "border-\[#0a4a31\] bg-\[#0f5c3e\] text-white"/);
  assert.match(source, /amber: "border-\[#6b4106\] bg-\[#8a5409\] text-white"/);
  assert.match(source, /rose: "border-\[#6e1430\] bg-\[#9b1c44\] text-white"/);
  assert.match(source, /slate: "border-\[#1e293b\] bg-\[#334155\] text-white"/);
});
