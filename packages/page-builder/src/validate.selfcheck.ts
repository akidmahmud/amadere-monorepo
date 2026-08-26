/**
 * Runnable self-check for the publish validator.
 *
 * Not a jest suite on purpose: this package has no test runner, and the thing
 * worth guarding is small and pure. `pnpm --filter @amader/page-builder build
 * && node dist/validate.selfcheck.js` exits non-zero if any rule regresses.
 */
import { strict as assert } from "node:assert";
import { validatePageDocument } from "./validate";
import { checkReservedSlug } from "./reserved-slugs";

function doc(content: unknown[], zones?: Record<string, unknown[]>) {
  return { root: { props: {} }, content, zones };
}
const block = (type: string, id: string, props: Record<string, unknown> = {}) => ({
  type,
  props: { id, ...props },
});

// --- shape -----------------------------------------------------------------
assert.equal(validatePageDocument({ nope: true }, "CONTENT").ok, false, "garbage rejected");
assert.equal(validatePageDocument(doc([]), "CONTENT").ok, true, "empty content page ok");

// --- unknown blocks --------------------------------------------------------
{
  const r = validatePageDocument(doc([block("NotARealBlock", "a")]), "CONTENT");
  assert.equal(r.ok, false);
  assert.match(r.errors.join(" "), /Unknown block/, "names the unknown block");
}

// --- duplicate ids ---------------------------------------------------------
{
  const r = validatePageDocument(doc([block("Heading", "x"), block("Spacer", "x")]), "CONTENT");
  assert.equal(r.ok, false);
  assert.match(r.errors.join(" "), /Duplicate block ids/);
}

// --- nested blocks inside slots are walked ---------------------------------
{
  const r = validatePageDocument(
    doc([block("Section", "s", { children: [block("Fake", "n")] })]),
    "CONTENT",
  );
  assert.equal(r.ok, false, "a bad block nested in a slot is still caught");
  assert.match(r.errors.join(" "), /Fake/);
}

// --- checkout requirements -------------------------------------------------
const fullCheckout = [
  block("CheckoutShippingAddress", "1"),
  block("CheckoutPaymentMethod", "2"),
  block("CheckoutOrderSummary", "3"),
  block("CheckoutTerms", "4"),
  block("CheckoutPlaceOrder", "5"),
];
assert.equal(validatePageDocument(doc(fullCheckout), "CHECKOUT").ok, true, "complete checkout ok");

{
  // Same document is fine as CONTENT — the requirement is kind-specific.
  assert.equal(validatePageDocument(doc([block("Heading", "h")]), "CONTENT").ok, true);
  const r = validatePageDocument(doc([block("Heading", "h")]), "CHECKOUT");
  assert.equal(r.ok, false);
  assert.match(r.errors.join(" "), /Place Order Button/, "uses the human label, not the identifier");
}

{
  const missingTerms = fullCheckout.filter((b) => b.type !== "CheckoutTerms");
  const r = validatePageDocument(doc(missingTerms), "CHECKOUT");
  assert.equal(r.ok, false);
  assert.match(r.errors.join(" "), /Terms Agreement/);
}

{
  const twice = [...fullCheckout, block("CheckoutPlaceOrder", "6")];
  const r = validatePageDocument(doc(twice), "CHECKOUT");
  assert.equal(r.ok, false, "two submit buttons rejected");
  assert.match(r.errors.join(" "), /only one Place Order Button/);
}

{
  // Neither address nor contact details -> rejected by the one-of rule.
  const neither = fullCheckout.filter((b) => b.type !== "CheckoutShippingAddress");
  const r = validatePageDocument(doc(neither), "CHECKOUT");
  assert.equal(r.ok, false);
  assert.match(r.errors.join(" "), /at least one of/);
  // ...but the digital-only variant alone is enough.
  const digital = [...neither, block("CheckoutContactDetails", "d")];
  assert.equal(validatePageDocument(doc(digital), "CHECKOUT").ok, true);
}

// --- legacy zones are walked too -------------------------------------------
{
  const r = validatePageDocument(doc([], { "s:col": [block("Bogus", "z")] }), "CONTENT");
  assert.equal(r.ok, false, "blocks in legacy zones are validated");
}

// --- reserved slugs --------------------------------------------------------
assert.equal(checkReservedSlug("about-us"), null);
assert.notEqual(checkReservedSlug("checkout"), null);
assert.notEqual(checkReservedSlug("/Checkout/"), null, "case and slashes normalised");
assert.notEqual(checkReservedSlug("account/settings"), null, "reserved first segment");
assert.notEqual(checkReservedSlug("api/anything"), null);
assert.notEqual(checkReservedSlug("  "), null);

console.log("validate.selfcheck: all assertions passed");
