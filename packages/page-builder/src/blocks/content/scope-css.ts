/**
 * Rewrites a pasted stylesheet so every rule applies only inside one container.
 *
 * This is what makes an indexable (non-iframe) HTML block possible. A pasted
 * page's CSS is written as though it owns the document — `*{margin:0}`,
 * `body{background:...}`, `:root{--ink:...}` — and injecting that into the
 * storefront unchanged would restyle the header, nav and footer. Scoping every
 * selector to the block's own container confines it.
 *
 * Deliberately NOT using the native `@scope` at-rule: it is still missing from
 * enough shipped browsers that a visitor on an older one would get the pasted
 * page's global reset applied to the whole site — the exact failure this
 * exists to prevent. A textual rewrite works everywhere.
 *
 * No React, no DOM: pure string in, string out, so it runs during a server
 * render and can be unit-checked.
 */

/** Split on top-level commas only — `:is(a, b)` and `[x="a,b"]` must survive. */
function splitSelectors(selectorList: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = "";

  for (const ch of selectorList) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;

    if (ch === "," && depth === 0) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) out.push(current);
  return out.map((s) => s.trim()).filter(Boolean);
}

/**
 * Document-level selectors have no equivalent inside a container, so they are
 * remapped onto the container itself rather than dropped — a pasted page's
 * `body { font-family: ... }` is how it sets its base type, and losing it would
 * strip the design back to nothing.
 */
function rewriteOne(selector: string, scope: string): string {
  const s = selector.trim();
  if (!s) return s;

  // Keep at-rule preludes and nonsense untouched.
  if (s.startsWith("@")) return s;

  // `html`, `body`, `:root` (alone or combined) become the container.
  const documentRoot = /^(html|body|:root)(\s*[:.[][^\s>+~]*)?$/i;
  if (documentRoot.test(s)) return scope + (s.replace(/^(html|body|:root)/i, "") || "");

  // `html body`, `body > x`, `:root .y` -> drop the document part, scope the rest.
  const leading = /^(html|body|:root)\s*([>+~]?\s*)/i;
  if (leading.test(s)) return `${scope} ${s.replace(leading, "").trim()}`;

  // A bare universal reset must also hit the container, or the container keeps
  // the site's own box-sizing while its children get the pasted page's.
  //
  // But it must NOT reach inside an embedded block. A pasted page's
  // `*{margin:0;padding:0}` has the same specificity as a Tailwind utility and
  // is injected later in the document, so it wins every tie -- every `mb-4`,
  // `p-5` and `gap-*` inside a portalled checkout block computed to 0 and the
  // card rendered as a flattened stack. Excluding the block subtree keeps the
  // pasted page's own reset intact while leaving the block's styling alone.
  if (s === "*") {
    // The exclusion is wrapped in :where() so it contributes ZERO specificity.
    // Written as plain :not([data-amader-block]):not([data-amader-block] *) the
    // rule scores (0,3,0) and starts outranking the pasted page's own class
    // rules -- `.hero-in { margin: 0 auto }` lost to the reset and the whole
    // design collapsed flush-left. With :where() the reset stays at (0,1,0),
    // exactly where a bare `*` reset belongs.
    return `${scope}, ${scope} *:not(:where([data-amader-block], [data-amader-block] *))`;
  }

  return `${scope} ${s}`;
}

/** At-rules whose bodies contain selectors that must NOT be scoped. */
const OPAQUE_AT_RULES = /^@(keyframes|-\w+-keyframes|font-face|counter-style|property|page|viewport)/i;
/** At-rules whose bodies contain ordinary rules and must be recursed into. */
const NESTED_AT_RULES = /^@(media|supports|container|layer|scope)\b/i;

export function scopeCss(css: string, scope: string): string {
  let out = "";
  let i = 0;

  while (i < css.length) {
    // Comments pass straight through.
    if (css.startsWith("/*", i)) {
      const end = css.indexOf("*/", i + 2);
      const stop = end === -1 ? css.length : end + 2;
      out += css.slice(i, stop);
      i = stop;
      continue;
    }

    // Read up to the next block or statement end.
    let j = i;
    let depth = 0;
    let quote: string | null = null;
    while (j < css.length) {
      const ch = css[j];
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === "(") depth++;
      else if (ch === ")") depth--;
      else if (ch === "{" && depth === 0) break;
      else if (ch === ";" && depth === 0) break;
      j++;
    }

    const prelude = css.slice(i, j);

    // A statement with no block: @import, @charset, stray semicolons.
    if (css[j] === ";" || j >= css.length) {
      out += prelude + (css[j] ?? "");
      i = j + 1;
      continue;
    }

    // Find the matching close brace.
    let k = j + 1;
    let braces = 1;
    quote = null;
    while (k < css.length && braces > 0) {
      const ch = css[k];
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === "/" && css[k + 1] === "*") {
        const end = css.indexOf("*/", k + 2);
        k = end === -1 ? css.length : end + 1;
      } else if (ch === "{") braces++;
      else if (ch === "}") braces--;
      k++;
    }
    const body = css.slice(j + 1, k - 1);
    const trimmed = prelude.trim();

    if (OPAQUE_AT_RULES.test(trimmed)) {
      // `0% { ... }` inside @keyframes is a keyframe position, not a selector.
      out += `${prelude}{${body}}`;
    } else if (NESTED_AT_RULES.test(trimmed)) {
      out += `${prelude}{${scopeCss(body, scope)}}`;
    } else {
      // Comments must come OUT of the prelude before the selector is read.
      // A pasted stylesheet routinely writes `/* --- HERO --- */` on the line
      // above a rule, and that text lands inside the prelude. Prefixing it
      // wholesale produced `.scope /* HERO */ :root`, which the parser reads
      // as a DESCENDANT :root -- a selector that matches nothing, because
      // :root is only ever <html>. Every custom property in the pasted page
      // silently stopped being defined, and the design rendered unstyled
      // while every individual rule still looked correct in the output.
      const comments = prelude.match(/\/\*[\s\S]*?\*\//g) ?? [];
      const selectorOnly = prelude.replace(/\/\*[\s\S]*?\*\//g, " ");
      const scoped = splitSelectors(selectorOnly)
        .map((sel) => rewriteOne(sel, scope))
        .join(", ");
      out += `${comments.join("")}${scoped}{${body}}`;
    }
    i = k;
  }

  return out;
}

/**
 * Pulls `<style>` blocks out of a pasted document and returns them separately
 * from the markup.
 *
 * Needed because the sanitiser strips `<style>` entirely — the CSS has to be
 * taken out, scoped, and re-emitted by us rather than surviving sanitisation.
 */
export function extractStyles(html: string): { css: string; markup: string } {
  const styles: string[] = [];
  const markup = html.replace(
    /<style\b[^>]*>([\s\S]*?)<\/style>/gi,
    (_m, inner: string) => {
      styles.push(inner);
      return "";
    },
  );
  return { css: styles.join("\n"), markup };
}

/**
 * `<link rel="stylesheet">` hrefs, so a pasted page's web fonts still load.
 * Only https URLs — a stylesheet from an arbitrary scheme is not something an
 * author should be able to introduce by pasting.
 */
export function extractStylesheetLinks(html: string): string[] {
  const out: string[] = [];
  const re = /<link\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tag = m[0];
    if (!/rel\s*=\s*["']?stylesheet/i.test(tag)) continue;
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (href && /^https:\/\//i.test(href)) out.push(href);
  }
  return out;
}
