import DOMPurify from "isomorphic-dompurify";
import {
  scopeCss,
  extractStyles,
  extractStylesheetLinks,
} from "./scope-css";
import { HtmlBlockPortals } from "./HtmlBlockPortals";

/**
 * Renders a pasted HTML page INLINE, so search engines index it.
 *
 * A SERVER component on purpose — no "use client" anywhere in this file. The
 * markup ends up in the HTML the crawler is served, which is the whole point;
 * a client-rendered version would be indexed far less reliably and would ship
 * JavaScript for what is static content.
 *
 * WHAT THIS COSTS, AND WHY IT IS STILL THE RIGHT DEFAULT FOR A LANDING PAGE
 *
 * Inline means the page shares the document with the storefront, so its
 * `<script>` tags and `onclick` handlers are stripped by the sanitiser — the
 * same rule every other admin-authored HTML on this site lives under. Pasted
 * interactivity (accordions, quantity pickers, mock order forms) will not run.
 * The sandboxed mode keeps the scripts and loses the indexing; that trade is
 * the author's to make, which is why it is a field rather than a decision made
 * here.
 *
 * CSS is scoped rather than trusted. A pasted page's stylesheet is written as
 * though it owns the document, so `*{margin:0}`, `body{...}` and `:root{...}`
 * are rewritten to apply only inside this block's container. Without that,
 * publishing a landing page would restyle the site header and footer.
 */
export function InlineHtmlPage({
  html,
  id,
  fullBleed = false,
}: {
  html: string;
  id: string;
  /** Hide the storefront header and footer so the pasted page owns the
   *  viewport. A landing page usually wants this; an About page never does. */
  fullBleed?: boolean;
}) {
  if (!html.trim()) {
    return (
      <div className="grid h-48 place-items-center rounded-brand border border-dashed border-line bg-beige font-body text-sm text-muted">
        Paste a full HTML page
      </div>
    );
  }

  // Derived from the block id so it is stable across renders and unique per
  // block — two pasted pages on one page must not share a scope.
  const scopeClass = `amd-html-${String(id).replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const { css, markup } = extractStyles(html);
  const fontLinks = extractStylesheetLinks(html);

  const clean = DOMPurify.sanitize(markup, {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling", "target"],
  });

  return (
    <>
      {/* React 19 hoists stylesheet links into <head>, so a pasted page's web
          fonts still load. Restricted to https by extractStylesheetLinks. */}
      {fontLinks.map((href) => (
        <link key={href} rel="stylesheet" href={href} />
      ))}
      {css.trim() && (
        <style
          // Scoped, so it cannot reach the storefront's own chrome.
          dangerouslySetInnerHTML={{ __html: scopeCss(css, `.${scopeClass}`) }}
        />
      )}
      <div
        className={scopeClass}
        // Marker only -- globals.css keys off it with :has(), the same way the
        // checkout route hides the mobile footer. Done in CSS because the
        // header and footer live in the locale layout, which is a Server
        // Component with no knowledge of which page is rendering.
        {...(fullBleed ? { "data-amader-fullbleed": "" } : {})}
        dangerouslySetInnerHTML={{ __html: clean }}
      />
      {/* Fills any <div data-amader-block="..."> the author left in their
          markup with the real block. Renders nothing server-side, so the
          pasted page's own HTML is still what a crawler reads. */}
      <HtmlBlockPortals scopeClass={scopeClass} />
    </>
  );
}
