// Simple block-based renderer (newsletter spec §6/§7) — not a full MJML/
// Canva-style builder on purpose. <table>-based markup is deliberate: it's
// the one layout primitive that survives every major email client's CSS
// stripping (Outlook/Gmail in particular), unlike flexbox/grid.
export type EmailBlockType = 'heading' | 'text' | 'image' | 'button' | 'divider' | 'spacer';

export interface EmailBlock {
  type: EmailBlockType;
  content: Record<string, unknown>;
}

export type EmailContentMode = 'blocks' | 'html';

export interface EmailContentJson {
  version: number;
  mode?: EmailContentMode;
  blocks: EmailBlock[];
  // Sanitized on write (see sanitize-campaign-html.util.ts) — safe to
  // dangerouslySetInnerHTML/srcDoc by the time it reaches here. Only
  // meaningful when mode === 'html'.
  html?: string;
}

export const EMPTY_EMAIL_CONTENT: EmailContentJson = { version: 1, mode: 'blocks', blocks: [] };

// The actual rendered HTML is the same for every recipient of a campaign
// except the per-recipient tracking token — rendering blocks -> HTML once
// per campaign and substituting this placeholder per recipient (one cheap
// string replace) is far cheaper than re-walking the block tree per send.
export const TRACKING_TOKEN_PLACEHOLDER = '__TRACKING_TOKEN__';
// Separate placeholder for the subscriber's own stable unsubscribe token
// (NewsletterSubscriber.unsubscribeToken) — distinct from the per-send
// tracking token above (NewsletterCampaignRecipient.trackingToken).
export const UNSUBSCRIBE_TOKEN_PLACEHOLDER = '__UNSUB_TOKEN__';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

function renderBlock(block: EmailBlock, buildClickUrl: (target: string) => string): string {
  switch (block.type) {
    case 'heading': {
      const text = String(block.content.text ?? '');
      const align = block.content.align === 'center' || block.content.align === 'right' ? block.content.align : 'left';
      if (!text) return '';
      return `<tr><td style="padding:16px 24px 8px;text-align:${align};font-size:22px;font-weight:bold;color:#1a1a1a;">${escapeHtml(text)}</td></tr>`;
    }
    case 'text': {
      const text = String(block.content.text ?? '');
      if (!text) return '';
      return `<tr><td style="padding:8px 24px;font-size:15px;line-height:1.6;color:#333333;">${escapeHtml(text).replace(/\n/g, '<br/>')}</td></tr>`;
    }
    case 'image': {
      const url = String(block.content.url ?? '');
      if (!url) return '';
      return `<tr><td style="padding:8px 24px;"><img src="${escapeAttr(url)}" alt="" style="max-width:100%;display:block;border:0;" /></td></tr>`;
    }
    case 'button': {
      const text = String(block.content.text ?? 'Shop Now');
      const url = String(block.content.url ?? '');
      if (!url) return '';
      return `<tr><td style="padding:16px 24px;text-align:center;"><a href="${escapeAttr(buildClickUrl(url))}" style="display:inline-block;background:#16a06d;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;">${escapeHtml(text)}</a></td></tr>`;
    }
    case 'divider':
      return `<tr><td style="padding:8px 24px;"><hr style="border:none;border-top:1px solid #e5e5e5;" /></td></tr>`;
    case 'spacer': {
      const height = Math.max(0, Math.min(200, Number(block.content.height) || 24));
      return `<tr><td style="height:${height}px;line-height:${height}px;font-size:1px;">&nbsp;</td></tr>`;
    }
    default:
      return '';
  }
}

const FOOTER_STYLE = 'padding:20px 24px;text-align:center;font-size:12px;color:#888888;';

// Custom-HTML designs (uploaded whole files, spec followup: "HTML design
// file upload") own their own <html>/<body> — wrapping them in our own
// <table> would nest documents. Instead the unsubscribe footer + tracking
// pixel are spliced in just before </body> (or appended, for a bare
// fragment upload with no <body> tag at all).
function injectFooter(html: string, footerHtml: string): string {
  const idx = html.toLowerCase().lastIndexOf('</body>');
  if (idx === -1) return html + footerHtml;
  return html.slice(0, idx) + footerHtml + html.slice(idx);
}

// unsubscribeUrl/trackingPixelUrl must already contain TRACKING_TOKEN_PLACEHOLDER
// where the per-recipient token goes — the caller (NewsletterCampaignsService)
// owns building the real base URLs; this util only knows content -> HTML.
export function renderCampaignHtml(
  content: EmailContentJson,
  opts: { unsubscribeUrl: string; trackingPixelUrl: string; buildClickUrl: (target: string) => string },
): string {
  const pixel = `<img src="${escapeAttr(opts.trackingPixelUrl)}" width="1" height="1" alt="" style="display:none;" />`;

  if (content.mode === 'html' && content.html) {
    const footer = `<div style="${FOOTER_STYLE}">Don't want to receive these emails? <a href="${escapeAttr(opts.unsubscribeUrl)}" style="color:#888888;">Unsubscribe</a></div>${pixel}`;
    return injectFooter(content.html, footer);
  }

  const rows = (content.blocks ?? []).map((b) => renderBlock(b, opts.buildClickUrl)).join('');
  return `<!doctype html>
<html>
<body style="margin:0;padding:24px 0;background:#f4f4f4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
${rows}
<tr><td style="${FOOTER_STYLE}border-top:1px solid #eeeeee;">
Don't want to receive these emails? <a href="${escapeAttr(opts.unsubscribeUrl)}" style="color:#888888;">Unsubscribe</a>
</td></tr>
</table>
${pixel}
</body>
</html>`;
}

// Plain-text fallback (some clients/spam filters want a text part). For
// custom HTML, a full HTML->text conversion needs a parser we don't have
// installed — ponytail: strip tags with a regex instead, add a real parser
// if this ever needs to preserve structure (links, lists) rather than just
// give spam filters some non-empty text part.
export function renderCampaignText(content: EmailContentJson): string {
  if (content.mode === 'html' && content.html) {
    return content.html
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return (content.blocks ?? [])
    .map((b) => (b.type === 'heading' || b.type === 'text' ? String(b.content.text ?? '') : b.type === 'button' ? String(b.content.text ?? '') : ''))
    .filter(Boolean)
    .join('\n\n');
}
