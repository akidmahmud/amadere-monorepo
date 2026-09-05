# Amader™ email templates

Three ready-to-paste HTML templates for the admin's **HTML** tab:

| Where | Screen |
|---|---|
| Newsletter Campaigns | Marketing → Newsletter Campaigns → edit → **HTML** tab |
| Newsletter Templates | Marketing → Newsletter Templates → **HTML** tab |
| Customer Campaigns | Marketing → Customer Campaigns → template → **HTML email** field |

Paste the whole block, including `<!DOCTYPE …>`.

---

## Before you paste — three things that will bite you

**1. Swap the two placeholder URLs.** Every template has:

- `https://cdn.amadere.com/logo.png` — replace with your real logo (upload it in
  Media, then copy the URL). ~320px wide artwork, displayed at 160px.
- `https://amadere.com/…` links — already point at the live site, but check the
  paths match real collections.

**2. Merge tags differ by screen.** Customer Campaigns resolves only names;
Newsletter Campaigns resolves none at the time of writing. Cart/recovery
messages resolve the full set.

| Tag | Customer Campaigns | Cart / Recovery |
|---|---|---|
| `{{firstName}}` | ✅ | ✅ |
| `{{customerName}}` | ✅ | ✅ |
| `{{amountWithCurrency}}` | ✗ | ✅ |
| `{{cartLink}}` / `{{checkoutLink}}` | ✗ | ✅ |
| `{{productNames}}` / `{{productLinks}}` | ✗ | ✅ |
| `{{siteName}}` / `{{siteUrl}}` | ✗ | ✅ |

An unresolved tag renders as **empty**, not as literal text — so a tag on the
wrong screen silently leaves a gap. Templates below use only `{{firstName}}`,
which works everywhere.

**3. Always fill the plain-text body too.** The HTML is sent *alongside* it, not
instead of it. Some clients block HTML, and a mail with no text alternative
scores worse with spam filters.

### Why these are built the way they are

Email HTML is not web HTML. These use `<table>` layout, inline styles, a 600px
body and `<!--[if mso]>` conditionals — because Outlook ignores `max-width`,
Gmail strips much of `<style>`, and flexbox/grid are unsupported in several
major clients. It looks dated on purpose.

The `<!--[if mso]>` blocks survive your sanitizer (it parks and restores them);
their contents are still sanitized, so scripts inside them are stripped.

---

## 1 — Welcome

For **Customer Campaigns**, trigger *"Once, when a customer is added"*, delay 0.

Suggested subject: `Welcome to Amader™, {{firstName}}`
Suggested plain-text body:

```
Hi {{firstName}}, welcome to Amader™.
We deliver honest, natural groceries across Bangladesh — atta, chal, tel, chatu, modhu.
Shop now: https://amadere.com
```

```html
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Welcome to Amader</title>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f2;">
<!-- Preheader: the grey line clients show next to the subject. Hidden in the body. -->
<div style="display:none; max-height:0; overflow:hidden; opacity:0;">Honest, natural groceries delivered across Bangladesh.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f2;">
<tr>
<td align="center" style="padding:24px 12px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; background-color:#ffffff; border-radius:14px;">
<tr>
<td align="center" style="padding:32px 32px 8px 32px;">
<img src="https://cdn.amadere.com/logo.png" alt="Amader" width="160" style="display:block; border:0; width:160px; max-width:160px;" />
</td>
</tr>
<tr>
<td style="padding:16px 32px 0 32px; font-family:Arial,Helvetica,sans-serif; font-size:26px; line-height:34px; font-weight:bold; color:#12261a;" align="center">
Welcome, {{firstName}}
</td>
</tr>
<tr>
<td style="padding:12px 32px 0 32px; font-family:Arial,Helvetica,sans-serif; font-size:16px; line-height:26px; color:#5c7266;" align="center">
Thanks for joining Amader™. We bring honest, natural groceries — atta, chal, tel, chatu and modhu — straight to your door, anywhere in Bangladesh.
</td>
</tr>
<tr>
<td align="center" style="padding:28px 32px 8px 32px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" bgcolor="#1e7439" style="border-radius:999px;">
<a href="https://amadere.com" target="_blank" style="display:inline-block; padding:14px 36px; font-family:Arial,Helvetica,sans-serif; font-size:16px; font-weight:bold; color:#ffffff; text-decoration:none; border-radius:999px;">Start shopping</a>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="padding:24px 32px 32px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #dfe7e1;">
<tr>
<td style="padding-top:20px; font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:22px; color:#5c7266;">
<strong style="color:#12261a;">Why shop with us</strong><br />
• 100% natural, no artificial colour or preservatives<br />
• Cash on delivery across Bangladesh<br />
• Sourced and packed by our own team
</td>
</tr>
</table>
</td>
</tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
<tr>
<td align="center" style="padding:18px 24px; font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:20px; color:#8a9d91;">
You are receiving this because you created an account at Amader™.<br />
<a href="https://amadere.com" target="_blank" style="color:#1e7439; text-decoration:underline;">amadere.com</a>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>
```

---

## 2 — Promotion / offer

For **Newsletter Campaigns**. Edit the three product cards; the row stacks on
mobile because each cell is a full-width table on small screens.

Suggested subject: `এই সপ্তাহের অফার — up to 20% off`

```html
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>This week at Amader</title>
<style type="text/css">
/* Gmail strips much of this, so nothing here is load-bearing — it only
   improves the stacking on clients that do honour it. */
@media only screen and (max-width:600px) {
  .stack { display:block !important; width:100% !important; max-width:100% !important; }
  .stack-pad { padding:0 0 16px 0 !important; }
}
</style>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f2;">
<div style="display:none; max-height:0; overflow:hidden; opacity:0;">Fresh stock, honest prices — this week only.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f2;">
<tr>
<td align="center" style="padding:24px 12px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; background-color:#ffffff; border-radius:14px;">
<tr>
<td align="center" style="padding:28px 24px 4px 24px;">
<img src="https://cdn.amadere.com/logo.png" alt="Amader" width="140" style="display:block; border:0; width:140px; max-width:140px;" />
</td>
</tr>
<tr>
<td bgcolor="#1e7439" style="padding:20px 24px; font-family:Arial,Helvetica,sans-serif; font-size:22px; line-height:30px; font-weight:bold; color:#ffffff;" align="center">
এই সপ্তাহের অফার<br />
<span style="font-size:14px; font-weight:normal; color:#d8ecdd;">Up to 20% off selected items</span>
</td>
</tr>
<tr>
<td style="padding:24px 24px 8px 24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td class="stack stack-pad" width="33%" valign="top" style="padding-right:12px;">
<a href="https://amadere.com/products/jober-atta" target="_blank" style="text-decoration:none;">
<img src="https://cdn.amadere.com/logo.png" alt="Jober Atta" width="170" style="display:block; border:0; width:100%; max-width:170px; border-radius:10px;" />
<div style="padding-top:10px; font-family:Arial,Helvetica,sans-serif; font-size:14px; font-weight:bold; color:#12261a;">Jober Atta 1kg</div>
<div style="font-family:Arial,Helvetica,sans-serif; font-size:14px; color:#1e7439;">৳350</div>
</a>
</td>
<td class="stack stack-pad" width="33%" valign="top" style="padding-right:12px;">
<a href="https://amadere.com/products/jober-chatu" target="_blank" style="text-decoration:none;">
<img src="https://cdn.amadere.com/logo.png" alt="Jober Chatu" width="170" style="display:block; border:0; width:100%; max-width:170px; border-radius:10px;" />
<div style="padding-top:10px; font-family:Arial,Helvetica,sans-serif; font-size:14px; font-weight:bold; color:#12261a;">Jober Chatu 1kg</div>
<div style="font-family:Arial,Helvetica,sans-serif; font-size:14px; color:#1e7439;">৳450</div>
</a>
</td>
<td class="stack" width="33%" valign="top">
<a href="https://amadere.com/products/sorisher-tel" target="_blank" style="text-decoration:none;">
<img src="https://cdn.amadere.com/logo.png" alt="Sorisher Tel" width="170" style="display:block; border:0; width:100%; max-width:170px; border-radius:10px;" />
<div style="padding-top:10px; font-family:Arial,Helvetica,sans-serif; font-size:14px; font-weight:bold; color:#12261a;">Sorisher Tel 1L</div>
<div style="font-family:Arial,Helvetica,sans-serif; font-size:14px; color:#1e7439;">৳300</div>
</a>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td align="center" style="padding:20px 24px 32px 24px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" bgcolor="#1e7439" style="border-radius:999px;">
<a href="https://amadere.com/collections/offers" target="_blank" style="display:inline-block; padding:14px 36px; font-family:Arial,Helvetica,sans-serif; font-size:16px; font-weight:bold; color:#ffffff; text-decoration:none; border-radius:999px;">Shop the offer</a>
</td>
</tr>
</table>
</td>
</tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
<tr>
<td align="center" style="padding:18px 24px; font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:20px; color:#8a9d91;">
Amader™ — honest, natural groceries.<br />
<a href="https://amadere.com" target="_blank" style="color:#1e7439; text-decoration:underline;">amadere.com</a>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>
```

---

## 3 — Plain / text-forward

The one that most reliably reaches the inbox. No images beyond the logo, no
columns — closest to a personal email, which is why it tends to beat designed
templates on reply rate. Good for restock news, a note from the founder, or a
win-back.

Suggested subject: `আপনার জন্য একটি খবর` or `A quick note from Amader™`

```html
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>A note from Amader</title>
</head>
<body style="margin:0; padding:0; background-color:#ffffff;">
<div style="display:none; max-height:0; overflow:hidden; opacity:0;">A short note from the Amader team.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;">
<tr>
<td align="center" style="padding:32px 16px;">
<!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr>
<td style="padding-bottom:24px;">
<img src="https://cdn.amadere.com/logo.png" alt="Amader" width="130" style="display:block; border:0; width:130px; max-width:130px;" />
</td>
</tr>
<tr>
<td style="font-family:Georgia,'Times New Roman',serif; font-size:17px; line-height:29px; color:#12261a;">
<p style="margin:0 0 18px 0;">Hi {{firstName}},</p>
<p style="margin:0 0 18px 0;">Write the message here, the way you would type it to one person. Two or three short paragraphs is plenty.</p>
<p style="margin:0 0 18px 0;">If there is one thing you want them to do, say it plainly and link it once:<br />
<a href="https://amadere.com" target="_blank" style="color:#1e7439; font-weight:bold; text-decoration:underline;">See what is in stock this week</a></p>
<p style="margin:0 0 6px 0;">Thanks for reading,</p>
<p style="margin:0; color:#5c7266;">The Amader™ team</p>
</td>
</tr>
<tr>
<td style="padding-top:28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #dfe7e1;">
<tr>
<td style="padding-top:16px; font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:20px; color:#8a9d91;">
Amader™ · <a href="https://amadere.com" target="_blank" style="color:#1e7439; text-decoration:underline;">amadere.com</a>
</td>
</tr>
</table>
</td>
</tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td>
</tr>
</table>
</body>
</html>
```

---

## Testing before you send

1. Paste into the HTML tab and use the **preview**.
2. Send yourself a test — the preview is a browser, not an email client, and
   they disagree.
3. Check on a phone. Over half of opens will be there.

The one thing a preview cannot show you is Outlook, which is exactly what the
`<!--[if mso]>` blocks exist for. If most of your list is on Gmail webmail and
phones, that matters less.
