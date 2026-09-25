import { test } from "node:test";
import assert from "node:assert/strict";
import { isPosHost, posRoute, safeNext } from "../src/lib/pos-host.ts";

test("isPosHost", () => {
  assert.equal(isPosHost("pos.amadere.com"), true);
  assert.equal(isPosHost("pos.localhost:3004"), true);
  assert.equal(isPosHost("admin.amadere.com"), false);
  assert.equal(isPosHost(null), false);
});

test("posRoute: root rewrites to /pos, admin pages redirect to /pos, pos/login/api pass", () => {
  assert.deepEqual(posRoute("/"), { rewrite: "/pos" });
  assert.deepEqual(posRoute("/orders"), { redirect: "/pos" });
  assert.equal(posRoute("/pos"), null);
  assert.equal(posRoute("/pos/transfers"), null);
  assert.equal(posRoute("/login"), null);
  assert.equal(posRoute("/api/backend/x"), null);
});

test("safeNext: only same-site paths survive the login redirect", () => {
  assert.equal(safeNext("/pos"), "/pos");
  assert.equal(safeNext("//evil.com"), "/");
  assert.equal(safeNext("https://evil.com"), "/");
  assert.equal(safeNext(null), "/");
  // Backslash and tab tricks browsers normalise into another host.
  assert.equal(safeNext(String.raw`/\evil.com`), "/");
  // A literal %09 stays an on-site path (no host change) — fine either way.
  assert.ok(!safeNext("/%09/evil.com").startsWith("//"));
  assert.equal(safeNext("/\t/evil.com"), "/");
  assert.equal(safeNext("/pos?x=1#y"), "/pos?x=1#y");
});
