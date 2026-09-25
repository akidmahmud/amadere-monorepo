import { test } from "node:test";
import assert from "node:assert/strict";
import { BUILTIN_POS_INVOICE, POS_INVOICE_TAGS, SAMPLE_POS_INVOICE, renderPosInvoice } from "../src/lib/pos-invoice.ts";

test("the built-in template uses only known tags and renders them all", () => {
  const known = new Set(POS_INVOICE_TAGS.map((t) => t.tag));
  for (const m of BUILTIN_POS_INVOICE.matchAll(/\{\{(\w+)\}\}/g)) assert.ok(known.has(m[1]), `unknown tag ${m[1]}`);
  const out = renderPosInvoice(BUILTIN_POS_INVOICE, SAMPLE_POS_INVOICE);
  assert.doesNotMatch(out, /\{\{/);
});

test("every documented tag is substituted", () => {
  const html = POS_INVOICE_TAGS.map((t) => `[{{${t.tag}}}]`).join("");
  assert.doesNotMatch(renderPosInvoice(html, SAMPLE_POS_INVOICE), /\{\{/);
});

test("values are HTML-escaped (a customer name can't inject markup)", () => {
  const out = renderPosInvoice("<p>{{customerName}}</p>", {
    ...SAMPLE_POS_INVOICE,
    customer: { name: '<img src=x onerror="alert(1)">', phone: "017" },
  });
  assert.doesNotMatch(out, /<img/);
  assert.match(out, /&lt;img/);
});

test("item rows show the variant; change row only when there is change", () => {
  const d = { ...SAMPLE_POS_INVOICE, items: [{ name: "Honey", variant: "1KG", qty: 2, unitPrice: 999, lineTotal: 1998 }] };
  assert.match(renderPosInvoice("{{itemsRows}}", d), /Honey.*1KG/s);
  assert.equal(renderPosInvoice("{{changeRow}}", { ...d, change: 0 }), "");
  assert.match(renderPosInvoice("{{changeRow}}", { ...d, tendered: 2500, change: 50 }), /Change/);
});

test("VAT label reflects added-on-top vs included", () => {
  assert.equal(renderPosInvoice("{{vatLabel}}", { ...SAMPLE_POS_INVOICE, vatRatePercent: 15, vatIncluded: false }), "VAT 15%");
  assert.equal(renderPosInvoice("{{vatLabel}}", { ...SAMPLE_POS_INVOICE, vatRatePercent: 15, vatIncluded: true }), "incl. VAT 15%");
});

test("unknown tags are left visible so a typo is noticed", () => {
  assert.equal(renderPosInvoice("{{nope}}", SAMPLE_POS_INVOICE), "{{nope}}");
});

test("refRow prints 'Ref: …' only when there is a reference", () => {
  assert.equal(renderPosInvoice("{{refRow}}", { ...SAMPLE_POS_INVOICE, trxRef: null }), "");
  assert.match(renderPosInvoice("{{refRow}}", { ...SAMPLE_POS_INVOICE, trxRef: "SLIP-1" }), /Ref: SLIP-1/);
  assert.match(renderPosInvoice(BUILTIN_POS_INVOICE, { ...SAMPLE_POS_INVOICE, trxRef: "SLIP-1" }), /Ref: SLIP-1/);
});
