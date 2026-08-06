import DOMPurify from "isomorphic-dompurify";

/**
 * CMS-authored rich text (product/page/blog content) is rendered via
 * dangerouslySetInnerHTML — sanitize it first so a compromised or careless
 * admin account can't plant a stored-XSS payload that runs for every
 * storefront visitor. Not needed for JSON-LD `<script>` tags (already-safe
 * JSON.stringify output) or the analytics provider snippets (those need
 * real <script> execution by design).
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    // DOMPurify's bare default strips <iframe> entirely (a general XSS
    // precaution) — but the admin editor's GeneralHtmlSupport config
    // deliberately allows admins to hand-author it (embeds via Source
    // editing, CKEditor's own MediaEmbed feature), so without this an
    // admin-authored iframe would look correct in the editor and on save,
    // then silently vanish the moment the storefront renders it here.
    // DOMPurify still strips dangerous attributes (onload, javascript: src,
    // etc.) on every tag regardless of this allowlist.
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling", "target"],
  });
}
