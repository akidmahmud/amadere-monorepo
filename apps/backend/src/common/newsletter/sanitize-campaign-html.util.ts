import DOMPurify from 'isomorphic-dompurify';

// Same reasoning as apps/web/src/lib/sanitize-html.ts: admin-uploaded HTML
// design files are rendered via dangerouslySetInnerHTML/srcDoc (in the
// preview panel) and mailed out to every subscriber, so a compromised or
// careless admin account can't turn an "upload your designer's email" flow
// into a stored-XSS/phishing vector. Sanitized once here at write time
// (create/update), not at render/send time, so every downstream consumer
// (preview, test send, real send) already has safe HTML.
export function sanitizeCampaignHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    WHOLE_DOCUMENT: true, // preserve <html>/<head>/<style> from an uploaded whole-file design
  });
}
