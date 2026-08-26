/**
 * Runnable self-check for the CSS scoper.
 *
 * This function is what stands between a pasted stylesheet and the storefront's
 * own header, nav and footer. If it regresses, a landing page's `*{margin:0}`
 * silently flattens the whole site, so the rules it must hold are pinned here.
 *
 *   pnpm --filter @amader/page-builder build
 *   node dist/scope-css.selfcheck.js
 */
import { strict as assert } from "node:assert";
import {
  scopeCss,
  extractStyles,
  extractStylesheetLinks,
} from "./blocks/content/scope-css";

const S = ".amd-x";
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

// --- document-level selectors are remapped, never left global --------------
assert.equal(norm(scopeCss("body{margin:0}", S)), ".amd-x{margin:0}");
assert.equal(norm(scopeCss("html{font-size:16px}", S)), ".amd-x{font-size:16px}");
assert.equal(norm(scopeCss(":root{--ink:#111}", S)), ".amd-x{--ink:#111}");

// The universal reset must cover the container itself as well as its children.
{
  // The reset must cover the container and its children, but NOT reach into an
  // embedded block -- a pasted `*{margin:0;padding:0}` outranks Tailwind
  // utilities by source order and flattened every portalled block.
  const out = norm(scopeCss("*{box-sizing:border-box}", S));
  assert.ok(out.startsWith(".amd-x, .amd-x *"), out);
  assert.ok(out.includes("[data-amader-block]"), out);
  // Must use :where() -- a bare :not() chain raises the reset to (0,3,0) and
  // it starts beating the pasted page's own class rules.
  assert.ok(out.includes(":not(:where("), out);
}

// --- ordinary selectors get prefixed ---------------------------------------
assert.equal(norm(scopeCss(".hero h1{color:red}", S)), ".amd-x .hero h1{color:red}");

// --- selector lists split on TOP-LEVEL commas only -------------------------
assert.equal(
  norm(scopeCss("h1,h2{margin:0}", S)),
  ".amd-x h1, .amd-x h2{margin:0}",
);
{
  // `:is(a, b)` must stay one selector -- splitting inside it produces
  // `.amd-x :is(a` which is invalid and silently kills the rule.
  const out = norm(scopeCss(":is(h1, h2) span{color:red}", S));
  assert.equal(out, ".amd-x :is(h1, h2) span{color:red}", out);
}
{
  const out = norm(scopeCss('[data-x="a,b"]{color:red}', S));
  assert.equal(out, '.amd-x [data-x="a,b"]{color:red}', out);
}

// --- @media recurses -------------------------------------------------------
{
  const out = norm(scopeCss("@media(max-width:600px){body{padding:0}.a{color:red}}", S));
  assert.equal(out, "@media(max-width:600px){.amd-x{padding:0}.amd-x .a{color:red}}", out);
}

// --- @keyframes must NOT be scoped ----------------------------------------
{
  // `0%`/`to` are keyframe positions. Prefixing them makes the animation
  // silently do nothing, which is very hard to spot.
  const out = norm(scopeCss("@keyframes slide{0%{opacity:0}to{opacity:1}}", S));
  assert.equal(out, "@keyframes slide{0%{opacity:0}to{opacity:1}}", out);
}
{
  const out = norm(scopeCss("@font-face{font-family:X;src:url(a.woff2)}", S));
  assert.equal(out, "@font-face{font-family:X;src:url(a.woff2)}", out);
}

// --- statements without blocks pass through --------------------------------
assert.match(scopeCss('@import "https://fonts.example/x.css";', S), /@import/);

// --- descendant document selectors -----------------------------------------
assert.equal(norm(scopeCss("body .card{color:red}", S)), ".amd-x .card{color:red}");

// --- a realistic paste ------------------------------------------------------
{
  const css = `
:root{--green:#2E7D32}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--paper);font-size:16px}
.nav{position:sticky}
@media(max-width:760px){.hero-in{grid-template-columns:1fr}}
@keyframes slide{to{transform:translateX(-50%)}}
`;
  const out = scopeCss(css, S);
  assert.ok(!/(^|})\s*body\s*{/.test(out), "no bare body rule may survive");
  assert.ok(!/(^|})\s*\*\s*{/.test(out), "no bare universal rule may survive");
  assert.ok(out.includes(":not(:where("), "reset must spare blocks without gaining specificity");
  assert.ok(!/(^|})\s*:root\s*{/.test(out), "no bare :root rule may survive");
  assert.ok(out.includes("@keyframes slide{to{"), "keyframes untouched");
  assert.ok(out.includes(".amd-x .nav"), "ordinary selectors scoped");
}

// --- extraction -------------------------------------------------------------
{
  const { css, markup } = extractStyles(
    "<head><style>a{color:red}</style></head><body><p>hi</p></body>",
  );
  assert.equal(css.trim(), "a{color:red}");
  assert.ok(!/<style/i.test(markup), "style block removed from markup");
  assert.ok(markup.includes("<p>hi</p>"), "markup preserved");
}
{
  const links = extractStylesheetLinks(
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=X">' +
      '<link rel="preconnect" href="https://x.test">' +
      '<link rel="stylesheet" href="http://insecure.test/a.css">',
  );
  assert.deepEqual(links, ["https://fonts.googleapis.com/css2?family=X"]);
}

// --- comments before a rule must not become part of the selector -----------
// Regression guard. A pasted stylesheet writes `/* --- HERO --- */` above its
// rules; that text sits inside the prelude, and prefixing it wholesale yields
// `.scope /* HERO */ :root`, i.e. a DESCENDANT :root, which matches nothing.
// Every custom property then silently stops being defined and the whole
// design renders unstyled while each rule still looks right in the output.
{
  const out = norm(scopeCss("/* HERO */" + String.fromCharCode(10) + ":root{--ink:#111}", S));
  assert.ok(out.includes(".amd-x{--ink:#111}"), out);
  assert.ok(!/:root/.test(out.replace(/\/\*[^*]*\*\//g, "")), out);
}
{
  const out = norm(scopeCss("/* c */ body{margin:0}", S));
  assert.ok(out.includes(".amd-x{margin:0}"), out);
}
{
  const out = norm(scopeCss("/* c */ *{box-sizing:border-box}", S));
  assert.ok(out.includes(".amd-x, .amd-x *"), out);
  assert.ok(out.includes(":not(:where("), out);
}
{
  const out = norm(scopeCss("/* c */ .hero{color:red}", S));
  assert.ok(out.includes(".amd-x .hero{color:red}"), out);
}

console.log("scope-css.selfcheck: all assertions passed");
