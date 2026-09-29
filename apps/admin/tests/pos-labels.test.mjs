import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLabelSheet } from "../src/lib/pos-labels.ts";

const label = { barcodeSvg: "<svg id='bc'></svg>" };

test("default page is 38x25mm with no margin", () => {
  const html = buildLabelSheet([label]);
  assert.match(html, /@page\s*\{\s*size:\s*38mm 25mm;\s*margin:\s*0/);
  assert.match(html, /width:\s*38mm/);
  assert.match(html, /height:\s*25mm/);
});

test("the size setting sets the page and keeps the barcode inside it", () => {
  const html = buildLabelSheet([label], { widthMm: 50, heightMm: 30 });
  assert.match(html, /size:\s*50mm 30mm/);
  assert.match(html, /max-width:\s*48mm;\s*max-height:\s*28mm/);
});

test("one label block per copy, each on its own page; barcode only", () => {
  const html = buildLabelSheet([label, label, label]);
  assert.equal(html.match(/class="label"/g).length, 3);
  assert.match(html, /break-after:\s*page/);
  assert.match(html, /<svg id='bc'><\/svg>/);
  assert.doesNotMatch(html, /Amader®|class="name"/);
});

test("a label without a barcode says so", () => {
  assert.match(buildLabelSheet([{ barcodeSvg: null }]), /No barcode/);
});
