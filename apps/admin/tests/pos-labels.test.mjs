import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLabelSheet } from "../src/lib/pos-labels.ts";

const label = { name: "Amader Ghee <b>", variant: "1KG", price: "৳ 600", barcodeSvg: "<svg id='bc'></svg>" };

test("the print document is exactly 40x30mm pages with no margin", () => {
  const html = buildLabelSheet([label]);
  assert.match(html, /@page\s*\{\s*size:\s*40mm 30mm;\s*margin:\s*0/);
  assert.match(html, /width:\s*40mm/);
  assert.match(html, /height:\s*30mm/);
});

test("one label block per copy, each on its own page", () => {
  const html = buildLabelSheet([label, label, label]);
  assert.equal(html.match(/class="label"/g).length, 3);
  assert.match(html, /break-after:\s*page/);
});

test("text is escaped; the barcode SVG is embedded as-is", () => {
  const html = buildLabelSheet([label]);
  assert.match(html, /Amader Ghee &lt;b&gt;/);
  assert.match(html, /<svg id='bc'><\/svg>/);
});

test("a label without a barcode says so", () => {
  assert.match(buildLabelSheet([{ ...label, barcodeSvg: null }]), /No barcode/);
});
