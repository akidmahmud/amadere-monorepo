import { CartSnapshotItem } from './recovery.service';

export interface RecoveryEmailInput {
  recipientName: string | null;
  cart: CartSnapshotItem[];
  subtotal: string;
  /** Site logo from Settings. Omitted from the mail entirely when unset —
   *  better no logo than a broken image icon at the top of the email. */
  logoUrl: string | null;
  /** Storefront origin, for product links and the cart link. */
  siteUrl: string;
  /** Sales WhatsApp number from Settings > WhatsApp. The button is dropped
   *  when it is not configured, rather than linking to a broken chat. */
  whatsappNumber: string | null;
  siteName: string;
  /** Editable copy. Supports {{name}} and {{total}}; anything else is left
   *  alone rather than blanked, so a typo shows up in the preview instead of
   *  silently deleting a word. */
  copy: {
    subject: string;
    heading: string;
    message: string;
    ctaLabel: string;
    whatsappLabel: string;
  };
}

export interface RenderedRecoveryEmail {
  subject: string;
  html: string;
  text: string;
}

function esc(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(v: string | number): string {
  const n = Number(v) || 0;
  return `৳${n.toLocaleString('en-BD')}`;
}

/**
 * The abandoned-cart email: logo, the exact products they left, a message in
 * Bangla, and a WhatsApp button through to sales.
 *
 * Deliberately one function shared by the preview endpoint and the send
 * endpoint. A preview that renders separately from what actually goes out is
 * worse than no preview at all — staff would approve one email and mail
 * another.
 *
 * Table layout and inline styles for the usual reason: Outlook ignores
 * `max-width`, Gmail strips much of `<style>`, and flexbox is unsupported in
 * several major clients.
 */
export function renderRecoveryEmail(input: RecoveryEmailInput): RenderedRecoveryEmail {
  const name = input.recipientName?.trim() || 'প্রিয় গ্রাহক';
  const base = input.siteUrl.replace(/\/$/, '');
  const fill = (text: string) =>
    text.replaceAll('{{name}}', name).replaceAll('{{total}}', money(input.subtotal));

  const rows = input.cart
    .map((item) => {
      const href = `${base}/products/${encodeURIComponent(item.slug)}`;
      // A cell with no image would collapse and knock the row out of
      // alignment, so the image cell is only emitted when there is one.
      const image = item.imageUrl
        ? `<td width="72" valign="top" style="padding:0 14px 0 0;">
             <a href="${esc(href)}" target="_blank"><img src="${esc(item.imageUrl)}" alt="${esc(item.name)}" width="72" style="display:block; border:0; width:72px; border-radius:8px;" /></a>
           </td>`
        : '';
      return `<tr>
        <td style="padding:0 0 16px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              ${image}
              <td valign="top" style="font-family:Arial,Helvetica,sans-serif;">
                <a href="${esc(href)}" target="_blank" style="font-size:15px; font-weight:bold; color:#12261a; text-decoration:none;">${esc(item.name)}</a>
                <div style="padding-top:4px; font-size:14px; color:#5c7266;">${item.quantity} × ${money(item.unitPrice)}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
    })
    .join('');

  const whatsapp = input.whatsappNumber?.trim()
    ? `<tr>
        <td align="center" style="padding:4px 32px 0 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" bgcolor="#25D366" style="border-radius:999px;">
                <a href="https://wa.me/${esc(input.whatsappNumber.trim().replace(/[^0-9]/g, ''))}" target="_blank" style="display:inline-block; padding:12px 30px; font-family:Arial,Helvetica,sans-serif; font-size:15px; font-weight:bold; color:#ffffff; text-decoration:none; border-radius:999px;">${esc(fill(input.copy.whatsappLabel))}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : '';

  const logo = input.logoUrl
    ? `<tr>
        <td align="center" style="padding:30px 32px 4px 32px;">
          <img src="${esc(input.logoUrl)}" alt="${esc(input.siteName)}" width="150" style="display:block; border:0; width:150px; max-width:150px;" />
        </td>
      </tr>`
    : '';

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(input.siteName)}</title>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f2;">
<div style="display:none; max-height:0; overflow:hidden; opacity:0;">আপনার কার্টে পণ্যগুলো এখনও অপেক্ষা করছে।</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f2;">
<tr>
<td align="center" style="padding:24px 12px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; background-color:#ffffff; border-radius:14px;">
${logo}
<tr>
<td style="padding:18px 32px 0 32px; font-family:Arial,Helvetica,sans-serif; font-size:22px; line-height:32px; font-weight:bold; color:#12261a;" align="center">
${esc(fill(input.copy.heading))}
</td>
</tr>
<tr>
<td style="padding:12px 32px 0 32px; font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:26px; color:#5c7266;" align="center">
${esc(fill(input.copy.message))}
</td>
</tr>
<tr>
<td style="padding:24px 32px 0 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #dfe7e1;">
<tr><td style="padding-top:20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${rows}
</table>
</td></tr>
<tr>
<td style="padding-top:6px; border-top:1px solid #dfe7e1; font-family:Arial,Helvetica,sans-serif; font-size:15px; font-weight:bold; color:#12261a;" align="right">
সর্বমোট: ${money(input.subtotal)}
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td align="center" style="padding:26px 32px 12px 32px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" bgcolor="#1e7439" style="border-radius:999px;">
<a href="${esc(base)}/cart" target="_blank" style="display:inline-block; padding:14px 36px; font-family:Arial,Helvetica,sans-serif; font-size:16px; font-weight:bold; color:#ffffff; text-decoration:none; border-radius:999px;">${esc(fill(input.copy.ctaLabel))}</a>
</td>
</tr>
</table>
</td>
</tr>
${whatsapp}
<tr><td style="padding:26px 32px 30px 32px;"></td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
<tr>
<td align="center" style="padding:18px 24px; font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:20px; color:#8a9d91;">
${esc(input.siteName)} · <a href="${esc(base)}" target="_blank" style="color:#1e7439; text-decoration:underline;">${esc(base.replace(/^https?:\/\//, ''))}</a>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;

  // Sent as the text/plain alternative. Not optional: some clients block HTML,
  // and a mail with no text part scores worse with spam filters.
  const text = [
    fill(input.copy.heading),
    '',
    fill(input.copy.message),
    '',
    ...input.cart.map((i) => `- ${i.name} — ${i.quantity} × ${money(i.unitPrice)}`),
    '',
    `সর্বমোট: ${money(input.subtotal)}`,
    `অর্ডার সম্পূর্ণ করুন: ${base}/cart`,
    input.whatsappNumber?.trim()
      ? `হোয়াটসঅ্যাপ: https://wa.me/${input.whatsappNumber.trim().replace(/[^0-9]/g, '')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    subject: fill(input.copy.subject),
    html,
    text,
  };
}
