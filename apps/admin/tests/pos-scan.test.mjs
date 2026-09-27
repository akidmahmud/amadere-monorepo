import { test } from "node:test";
import assert from "node:assert/strict";
import { scanChar, isScanEnd } from "../src/lib/pos-scan.ts";

// What a scanner sends for "AMD-091" with a BANGLA keyboard layout active:
// e.key is Bangla, e.code is the physical key.
const bangla = [
  { key: "অ", code: "KeyA", shiftKey: true },
  { key: "ম", code: "KeyM", shiftKey: true },
  { key: "ড", code: "KeyD", shiftKey: true },
  { key: "-", code: "Minus", shiftKey: false },
  { key: "০", code: "Digit0", shiftKey: false },
  { key: "৯", code: "Digit9", shiftKey: false },
  { key: "১", code: "Numpad1", shiftKey: false },
];

test("scanChar reads the physical key, so a Bangla layout doesn't garble codes", () => {
  assert.equal(bangla.map(scanChar).join(""), "AMD-091");
});

test("scanChar: lower case without Shift; Shift-only and function keys add nothing", () => {
  assert.equal(scanChar({ key: "a", code: "KeyA", shiftKey: false }), "a");
  assert.equal(scanChar({ key: "Shift", code: "ShiftLeft", shiftKey: true }), null);
  assert.equal(scanChar({ key: "!", code: "Digit1", shiftKey: true }), "!");
  assert.equal(scanChar({ key: "F4", code: "F4", shiftKey: false }), null);
});

test("a scan ends with Enter or Tab", () => {
  assert.ok(isScanEnd("Enter") && isScanEnd("Tab") && !isScanEnd("a"));
});
