import { test } from "node:test";
import assert from "node:assert/strict";
import { hostOnlyExpiry } from "../src/lib/cookie-expiry.ts";

test("no shared domain configured → nothing to expire", () => {
  assert.deepEqual(hostOnlyExpiry(undefined, true), []);
});

test("shared domain → expire the old host-only copies (no Domain attribute)", () => {
  const h = hostOnlyExpiry(".amadere.com", true);
  assert.equal(h.length, 2);
  for (const line of h) {
    assert.match(line, /^admin_(access|refresh)_token=; Path=\/; Max-Age=0; HttpOnly; SameSite=Lax; Secure$/);
    assert.doesNotMatch(line, /Domain/i);
  }
});
