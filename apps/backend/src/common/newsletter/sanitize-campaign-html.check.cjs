/**
 * Check for sanitize-campaign-html.util.ts.
 *
 * Not a .spec.ts: isomorphic-dompurify pulls jsdom, which pulls ESM-only
 * packages that this app's ts-jest setup cannot transform without reworking
 * the shared jest config. A plain node script proves the same thing.
 *
 *   node src/common/newsletter/sanitize-campaign-html.check.cjs
 *
 * Mirrors the util's logic. If you change the util, change this too — the
 * duplication is deliberate and cheap next to a jest ESM migration.
 */
const DOMPurify = require('isomorphic-dompurify');

const MSO_CONDITIONAL = /<!--\[if [^\]]*\]>([\s\S]*?)<!\[endif\]-->/gi;
const DOCTYPE = /^\s*<!DOCTYPE[^>]*>/i;

function sanitizeCampaignHtml(html) {
  const doctype = (html.match(DOCTYPE) || [''])[0];
  const parked = [];
  const withPlaceholders = html.replace(MSO_CONDITIONAL, (full, inner) => {
    const clean = DOMPurify.sanitize(inner, { ADD_ATTR: ['target'] });
    parked.push(full.replace(inner, clean));
    return `AMADERMSO${parked.length - 1}ENDMSO`;
  });
  let out = DOMPurify.sanitize(withPlaceholders, {
    WHOLE_DOCUMENT: true,
    ADD_ATTR: ['target'],
  });
  parked.forEach((block, i) => {
    out = out.replace(`AMADERMSO${i}ENDMSO`, block);
  });
  return doctype ? `${doctype}\n${out}` : out;
}

const TEMPLATE = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN">
<html><head><meta charset="utf-8">
<style>.btn{background:#1e7439;color:#fff;padding:12px 24px}</style>
</head>
<body style="margin:0;font-family:Arial">
<!--[if mso]><table role="presentation"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" bgcolor="#f4f4f4">
<tr><td align="center">
<img src="https://cdn.amadere.com/logo.png" width="160" alt="Amader">
<h1 style="color:#12261a">Hi {{first_name}}</h1>
<a href="https://amadere.com" class="btn" target="_blank">Shop now</a>
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</body></html>`;

const NASTY =
  '<!DOCTYPE html><html><body>' +
  '<script>alert(1)</script>' +
  '<!--[if mso]><script>alert(2)</script><b>ok</b><![endif]-->' +
  '<img src=x onerror="alert(3)">' +
  '<a href="javascript:alert(4)">bad</a>' +
  '</body></html>';

const kept = sanitizeCampaignHtml(TEMPLATE);
const cleaned = sanitizeCampaignHtml(NASTY);

// Each "must keep" below was silently destroyed by the plain DOMPurify call
// this util replaced — which is what made pasted email templates render wrong.
const checks = [
  ['keeps <style> block', kept.includes('.btn{background:#1e7439')],
  ['keeps inline style', kept.includes('font-family:Arial')],
  ['keeps bgcolor', kept.includes('bgcolor="#f4f4f4"')],
  ['keeps img src', kept.includes('cdn.amadere.com/logo.png')],
  ['keeps link href', kept.includes('href="https://amadere.com"')],
  ['keeps target=_blank', kept.includes('target="_blank"')],
  ['keeps merge tag', kept.includes('{{first_name}}')],
  ['keeps BOTH mso conditionals', (kept.match(/\[if mso\]/g) || []).length === 2],
  ['keeps doctype', kept.toLowerCase().includes('<!doctype html')],
  ['strips <script>', !cleaned.includes('<script')],
  ['strips script INSIDE conditional', !cleaned.includes('alert(2)')],
  ['strips onerror', !cleaned.includes('onerror')],
  ['strips javascript: href', !cleaned.includes('javascript:')],
  ['keeps safe markup inside conditional', cleaned.includes('<b>ok</b>')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
process.exit(failed === 0 ? 0 : 1);
