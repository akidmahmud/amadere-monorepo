import DOMPurify from 'isomorphic-dompurify';

// Same reasoning as apps/web/src/lib/sanitize-html.ts: admin-uploaded HTML
// design files are rendered via dangerouslySetInnerHTML/srcDoc (in the
// preview panel) and mailed out to every subscriber, so a compromised or
// careless admin account can't turn an "upload your designer's email" flow
// into a stored-XSS/phishing vector. Sanitized once here at write time
// (create/update), not at render/send time, so every downstream consumer
// (preview, test send, real send) already has safe HTML.

/** Outlook conditional comments: `<!--[if mso]> ... <![endif]-->`. */
const MSO_CONDITIONAL = /<!--\[if [^\]]*\]>([\s\S]*?)<!\[endif\]-->/gi;
/** Email templates open with an XHTML doctype; DOMPurify drops it. */
const DOCTYPE = /^\s*<!DOCTYPE[^>]*>/i;

function purify(html: string): string {
  return DOMPurify.sanitize(html, {
    WHOLE_DOCUMENT: true, // preserve <html>/<head>/<style> from an uploaded whole-file design
    // Without this every link in an email loses target="_blank". Safe: it
    // only chooses where a link opens, and href is still filtered.
    ADD_ATTR: ['target'],
  });
}

/**
 * Sanitize an uploaded email design, keeping the three things a real email
 * template cannot survive without.
 *
 * Measured against a typical generated template, the plain DOMPurify call
 * this replaces silently destroyed:
 *   - `target="_blank"` on every link
 *   - `<!--[if mso]>` conditionals, i.e. Outlook rendering
 *   - the doctype
 *
 * Conditional comments are handled by sanitizing their CONTENTS and then
 * putting the wrapper back, rather than by allowing comments through
 * wholesale: the payload inside still gets the full treatment, so the old IE
 * conditional-comment script vector stays closed.
 *
 * Checked by sanitize-campaign-html.check.cjs (a node script rather than a
 * .spec.ts — jsdom drags in ESM-only packages this app's ts-jest cannot
 * transform).
 */
export function sanitizeCampaignHtml(html: string): string {
  const doctype = html.match(DOCTYPE)?.[0] ?? '';

  // Park the conditionals so DOMPurify cannot eat them, sanitizing what is
  // inside each one on its own.
  const parked: string[] = [];
  const withPlaceholders = html.replace(MSO_CONDITIONAL, (full, inner: string) => {
    const clean = DOMPurify.sanitize(inner, { ADD_ATTR: ['target'] });
    parked.push(full.replace(inner, clean));
    // A PLAIN TEXT token, not a comment-shaped one: DOMPurify deletes
    // comments outright, so a comment placeholder would vanish and take the
    // conditional with it.
    return `AMADERMSO${parked.length - 1}ENDMSO`;
  });

  let out = purify(withPlaceholders);

  parked.forEach((block, i) => {
    out = out.replace(`AMADERMSO${i}ENDMSO`, block);
  });

  return doctype ? `${doctype}\n${out}` : out;
}
