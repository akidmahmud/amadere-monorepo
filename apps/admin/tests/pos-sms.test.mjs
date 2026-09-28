import { test } from "node:test";
import assert from "node:assert/strict";
import { renderSmsPreview, smsParts } from "../src/lib/pos-sms.ts";

test("English = 160 per SMS, 153 per part after that", () => {
  assert.deepEqual(smsParts("a".repeat(160)), { chars: 160, parts: 1, unicode: false });
  assert.equal(smsParts("a".repeat(161)).parts, 2);
});

test("Bangla or ৳ makes it Unicode: 70 per SMS, 67 per part", () => {
  assert.equal(smsParts("ধন্যবাদ").unicode, true);
  assert.equal(smsParts("Total ৳360").unicode, true);
  assert.equal(smsParts("৳".repeat(71)).parts, 2);
});

test("preview fills tags like the server", () => {
  assert.equal(renderSmsPreview("Hi {{name}} {{x}}!", { name: "Karim" }), "Hi Karim !");
});
