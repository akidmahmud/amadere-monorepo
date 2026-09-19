import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSalesSheet } from "../src/components/net-profit/sales-report/salesSheet.ts";

// Order D56505 as the report returns it — the same order is row 5 of the
// owner's "Daily Sales Data.xlsx", which this export must reproduce.
const d56505 = {
  o: {
    id: 3, orderNumber: "ORD-20260801-D56505", date: "2026-08-01", status: "Delivered", channel: "WhatsApp",
    agentId: 1, agentName: "Jami", customer: "Estiyak", phone: "1521770934", ctype: "New", district: "Dhaka",
    zone: "Inside Dhaka", payment: "COD", advance: 0, courier: "Sundarban", delivery: 80, actual: 145, hist: {},
  },
  lines: [{ key: "MC1", name: "Mixed Chatu 1 kg", qty: 1, price: 350, disc: 35, gross: 350, weight: 1, unitWeight: 1, unitCost: 180, costOk: false, cogs: 180 }],
  netSales: 315, weight: 1, zone: "Inside Dhaka", collect: 395, shipped: true,
  rate: 105, cod: 3.15, expected: 108.15, courierCharge: 145, estimated: false, overcharge: 36.85,
  cogs: 180, packaging: 0, fee: 0, contribution: 70, subsidy: 65, receivable: 250, unconfirmed: true, flags: [],
};

test("two header rows: the sheet's group labels, then its 26 column titles plus Invoice Value", () => {
  const [groups, head] = buildSalesSheet([], { Sundarban: 1 }, true);
  assert.equal(head.length, 27);
  assert.equal(head[0], "Date");
  assert.equal(head[11], "Sale Value");
  assert.equal(head[12], "Invoice Value");
  assert.equal(head[26], "Gain/Loss");
  assert.equal(groups[12], "");
  assert.equal(groups[13], "Actual value - Sale value");
  assert.equal(groups[18], "As per courier logic");
});

test("reproduces row 5 of Daily Sales Data.xlsx", () => {
  const [, , row] = buildSalesSheet([d56505], { Sundarban: 1 }, true);
  assert.deepEqual(row, [
    "Aug 01, 2026", "ORD-20260801-D56505", "Delivered", "WhatsApp", "Jami", "New", "Estiyak", "1521770934", "Dhaka",
    // 395 = Invoice Value: sale 315 + delivery 80 charged from the customer.
    "Mixed Chatu 1 kg", 1, 315, 395, 35, "COD", "Sundarban", 80, 145, 105, "1%", 3.15, 108.15, -36.85, 250, 180, 180, 70,
  ]);
});

test("multi-product orders: order-level money only on the first line", () => {
  const two = { ...d56505, netSales: 515, lines: [d56505.lines[0], { ...d56505.lines[0], key: "X", name: "Other 500 g", qty: 2, price: 100, disc: 0, weight: 1, unitWeight: 0.5, unitCost: 40, cogs: 80 }] };
  const [, , first, second] = buildSalesSheet([two], { Sundarban: 1 }, true);
  // Invoice Value covers the whole order (315 + 200 + 80 delivery), first line only.
  assert.equal(first[12], 595);
  assert.equal(first[16], 80);
  assert.deepEqual(second.slice(0, 2), ["Aug 01, 2026", "ORD-20260801-D56505"]);
  assert.deepEqual(second.slice(9, 16), ["Other 500 g", 1, 200, "", "", "COD", "Sundarban"]);
  assert.deepEqual(second.slice(16, 24), ["", "", "", "", "", "", "", ""]);
  assert.deepEqual(second.slice(24), [80, 80, ""]);
});

test("product column prints the SKU, falling back to the name when none is entered", () => {
  const withSku = { ...d56505, lines: [{ ...d56505.lines[0], sku: "MC-1KG" }] };
  const [, head, row] = buildSalesSheet([withSku], { Sundarban: 1 }, true);
  assert.equal(head[9], "Product SKU");
  assert.equal(row[9], "MC-1KG");
  const [, , noSku] = buildSalesSheet([d56505], { Sundarban: 1 }, true);
  assert.equal(noSku[9], "Mixed Chatu 1 kg");
});

test("agents get the sales columns only", () => {
  const [groups, head, row] = buildSalesSheet([d56505], {}, false);
  assert.equal(head.length, 15);
  assert.equal(groups.length, 15);
  assert.equal(row[14], "Sundarban");
  assert.ok(!head.includes("Invoice Value")); // needs the delivery charge agents never get
});
