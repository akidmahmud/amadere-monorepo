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
  return DOMPurify.sanitize(html);
}
