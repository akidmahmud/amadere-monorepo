import { test } from "node:test";
import assert from "node:assert/strict";
import { tk, pc, dmy, csvText } from "../src/components/net-profit/sales-report/format.ts";

test("tk formats taka with a true minus and optional plus", () => {
  assert.equal(tk(3438), "৳3,438");
  assert.equal(tk(-130), "−৳130");
  assert.equal(tk(12, true), "+৳12");
  assert.equal(tk(null), "-");
});

test("pc and dmy", () => {
  assert.equal(pc(0.31354), "31.4%");
  assert.equal(dmy("2026-08-01"), "01/08/2026");
});

test("csvText quotes cells that need it", () => {
  assert.equal(csvText([["a", 'b"c', 1]]), 'a,"b""c",1');
});
