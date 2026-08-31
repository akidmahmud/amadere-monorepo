-- The digital order-placed email only ever carried `downloads_url` — a link
-- to My Account > Downloads, which bounces a buyer with no active session to
-- the login page. The direct, token-gated per-file links went out in a
-- SEPARATE `digital_download` email, so the mail that says "your order is
-- complete" had nothing on it you could actually click to get the file.
--
-- `download_links` (new, rendered by OrderEmailsService.buildDownloadLinksHtml)
-- is one button per UNLOCKED file. Both links now live in this one email: the
-- direct download first, the account link after it as the durable way back.
--
-- Only rewrites `body_html` where the admin has NOT customised it
-- (body_html = default_body_html); `default_body_html` and `variables` are
-- always brought up to date so the editor's "reset to default" and its
-- variable list stay correct either way.
-- Hand-written + `migrate deploy`: `prisma migrate dev` cannot run in this
-- repo (pre-existing FK violation in 20260807103916_promo_videos_standalone).

WITH new_body AS (
  SELECT '{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">Thanks, {{ customer_name }} — your order is complete.</h2>
<p style="margin:0 0 20px;line-height:1.6;">Order <strong>{{ order_id }}</strong> is confirmed. There is nothing to ship and nothing left to pay: your files are available right now.</p>
<h3 style="margin:0 0 8px;color:#1e2b22;font-size:15px;">Your purchase</h3>
{{ product_list }}
<p style="margin:16px 0 24px;"><strong>Total paid: {{ total }}</strong></p>
{{ download_links }}
<p style="margin:0 0 24px;text-align:center;">
  <a href="{{ downloads_url }}" style="display:inline-block;background:#ffffff;color:#2e7d43;border:1px solid #2e7d43;padding:11px 27px;border-radius:8px;text-decoration:none;font-weight:bold;">Or open My Account &rarr; Downloads</a>
</p>
<p style="margin:0;color:#64766b;font-size:13px;line-height:1.6;">Keep the download links private -- anyone who has one can download that file. Your purchases also stay in My Account &rarr; Downloads, so you can come back to them any time.</p>
{{ footer }}'::text AS body
),
new_vars AS (
  SELECT '[{"key": "order_id", "description": "The order number"}, {"key": "customer_name", "description": "The customer''s name"}, {"key": "customer_phone", "description": "The customer''s phone number"}, {"key": "product_list", "description": "Every item on the order, pre-rendered as an HTML list"}, {"key": "total", "description": "The order total, with currency"}, {"key": "download_links", "description": "Direct download buttons, one per unlocked file (empty until payment is confirmed)"}, {"key": "downloads_url", "description": "Link to My Account > Downloads"}]'::jsonb AS vars
)
UPDATE email_templates t
SET
  body_html = CASE
    WHEN t.body_html IS NOT DISTINCT FROM t.default_body_html THEN (SELECT body FROM new_body)
    ELSE t.body_html
  END,
  default_body_html = (SELECT body FROM new_body),
  variables = (SELECT vars FROM new_vars),
  updated_at = NOW()
WHERE t.key = 'digital_order_placed';
