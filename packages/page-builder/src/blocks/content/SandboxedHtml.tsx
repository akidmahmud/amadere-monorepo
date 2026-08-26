"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Renders a complete, self-contained HTML document inside a sandboxed iframe.
 *
 * WHY AN IFRAME AND NOT INLINE HTML
 *
 * The sibling HtmlEmbed block sanitises and injects markup into the page, which
 * is right for a snippet that should inherit site styling. It is the wrong tool
 * for a whole page: DOMPurify strips `<style>`, `<script>`, every `onclick`, and
 * the whole `<head>`, so a pasted design arrives with no CSS and dead buttons.
 *
 * Even if the CSS survived, inlining it would be worse. A pasted page routinely
 * contains rules like `*{margin:0}`, `body{...}` and `:root{--ink:...}`, which
 * would apply to the entire storefront — header, nav, footer and all. The frame
 * seals them in.
 *
 * SECURITY
 *
 * `allow-scripts` WITHOUT `allow-same-origin` is deliberate and the two must
 * never appear together: that combination lets the frame reach into its own
 * sandbox attribute and remove it. As written the frame gets an opaque origin,
 * so its scripts cannot touch the parent document, cookies, or storage.
 *
 * `allow-forms` lets the pasted page's own inputs behave normally, and
 * `allow-popups` lets `target="_blank"` links open. Neither grants access to
 * the parent.
 */
export function SandboxedHtml({
  html,
  minHeight,
}: {
  html: string;
  minHeight: number;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(minHeight);
  // Correlates height messages with this frame. The sandbox has no
  // same-origin access, so `event.origin` is the string "null" for every
  // frame on the page — a token is the only way to tell them apart.
  const token = useId();

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as { __amaderFrame?: string; height?: number };
      if (!data || data.__amaderFrame !== token) return;
      if (typeof data.height === "number" && data.height > 0) {
        setHeight(Math.max(minHeight, Math.ceil(data.height)));
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [token, minHeight]);

  if (!html.trim()) {
    return (
      <div className="grid h-48 place-items-center rounded-brand border border-dashed border-line bg-beige font-body text-sm text-muted">
        Paste a full HTML page
      </div>
    );
  }

  // The reporter is appended rather than injected into <head>: the pasted
  // document may not have one, and appending to the end of the source works
  // whether or not the browser has already closed <body> for us.
  const reporter = `
<script>
(function(){
  var token = ${JSON.stringify(token)};
  function post(){
    var d = document.documentElement;
    var b = document.body;
    var h = Math.max(
      d ? d.scrollHeight : 0, d ? d.offsetHeight : 0,
      b ? b.scrollHeight : 0, b ? b.offsetHeight : 0
    );
    parent.postMessage({ __amaderFrame: token, height: h }, "*");
  }
  // Report on load, on resize, and whenever the DOM changes -- an accordion
  // or a revealed section changes the height long after load.
  window.addEventListener("load", post);
  window.addEventListener("resize", post);
  if (window.ResizeObserver && document.documentElement) {
    new ResizeObserver(post).observe(document.documentElement);
  }
  document.addEventListener("click", function(){ setTimeout(post, 400); }, true);
  setTimeout(post, 60); setTimeout(post, 400); setTimeout(post, 1200);
})();
<\/script>`;

  return (
    <iframe
      ref={frameRef}
      title="Embedded page"
      // NEVER add allow-same-origin here -- see the security note above.
      sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
      srcDoc={html + reporter}
      loading="lazy"
      style={{ height }}
      className="w-full border-0"
    />
  );
}
