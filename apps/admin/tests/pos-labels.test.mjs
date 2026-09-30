import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLabelSheet, labelSizeText } from "../src/lib/pos-labels.ts";

const label = { barcodeSvg: "<svg id='bc'></svg>", name: "Amader Ghee <b>", size: "1KG" };

test("default page is 38x25mm with no margin", () => {
  const html = buildLabelSheet([label]);
  assert.match(html, /@page\s*\{\s*size:\s*38mm 25mm;\s*margin:\s*0/);
  assert.match(html, /width:\s*38mm/);
  assert.match(html, /height:\s*25mm/);
});

test("name and size print by default (escaped); the barcode gets the rest of the height", () => {
  const html = buildLabelSheet([label]);
  assert.match(html, /class="name">Amader Ghee &lt;b&gt;</);
  assert.match(html, /class="size">1KG</);
  assert.match(html, /max-width:\s*36mm;\s*max-height:\s*16\.6mm/);
});

test("switches off = barcode only, full height", () => {
  const html = buildLabelSheet([label], { widthMm: 50, heightMm: 30, showName: false, showSize: false });
  assert.match(html, /size:\s*50mm 30mm/);
  assert.doesNotMatch(html, /class="name"|class="size"/);
  assert.match(html, /max-width:\s*48mm;\s*max-height:\s*28\.0mm/);
});

test("one label block per copy, each on its own page", () => {
  const html = buildLabelSheet([label, label, label]);
  assert.equal(html.match(/class="label"/g).length, 3);
  assert.match(html, /break-after:\s*page/);
  assert.match(html, /<svg id='bc'><\/svg>/);
});

test("a label without a barcode says so", () => {
  assert.match(buildLabelSheet([{ barcodeSvg: null }]), /No barcode/);
});

test("size text: pack size, else weight; the store's own weight wins", () => {
  assert.equal(labelSizeText({ variantLabel: "1KG" }), "1KG");
  assert.equal(labelSizeText({ normalWeightKg: "0.5", normalWeightUnit: "g" }), "500 g");
  assert.equal(labelSizeText({ variantLabel: "1KG", storeWeightKg: "1.5", storeWeightUnit: "l" }), "1.5 L");
  assert.equal(labelSizeText({}), null);
});
