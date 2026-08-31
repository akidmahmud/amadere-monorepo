-- The `digital_download` email template exists only in
-- packages/db/seed-email-templates.sql, which production never ran — so
-- OrderEmailsService.sendDigitalDownload logged, on every digital purchase:
--
--   Order email (digital_download) not sent: Email template
--   "digital_download" not found
--
-- The buyer got `digital_order_placed` (whose CTA is My Account > Downloads,
-- i.e. the login page for anyone without a session) and never the mail
-- carrying the actual token link. Moved into a migration so `migrate deploy`
-- installs it, rather than depending on a seed file being run by hand.
--
-- ON CONFLICT DO NOTHING: safe to re-run, and never clobbers wording an admin
-- has since edited on an environment that already has the row.
-- Hand-written + `migrate deploy`: `prisma migrate dev` cannot run in this
-- repo (pre-existing FK violation in 20260807103916_promo_videos_standalone).

INSERT INTO email_templates (key, "group", title, description, subject, body_html, default_subject, default_body_html, variables, can_disable, enabled, created_at, updated_at) VALUES ('digital_download', 'ECOMMERCE', 'Digital Download Ready', 'Send the private download link to the customer once their digital purchase is paid for', 'Your download for order {{ order_id }} is ready', '{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">Your download is ready, {{ customer_name }}!</h2>
<p style="margin:0 0 20px;line-height:1.6;">Payment for order <strong>{{ order_id }}</strong> is confirmed, so <strong>{{ product_name }}</strong> is yours to keep.</p>
<p style="margin:0 0 24px;text-align:center;">
  <a href="{{ download_url }}" style="display:inline-block;background:#2e7d43;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Download your file</a>
</p>
<p style="margin:0 0 16px;color:#64766b;font-size:13px;line-height:1.6;">Please keep this link private -- it is the key to your purchase, and anyone who has it can download the file.</p>
<p style="margin:0;color:#64766b;font-size:13px;line-height:1.6;">You can find all of your purchases again any time under My Account &rarr; Downloads.</p>
{{ footer }}', 'Your download for order {{ order_id }} is ready', '{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">Your download is ready, {{ customer_name }}!</h2>
<p style="margin:0 0 20px;line-height:1.6;">Payment for order <strong>{{ order_id }}</strong> is confirmed, so <strong>{{ product_name }}</strong> is yours to keep.</p>
<p style="margin:0 0 24px;text-align:center;">
  <a href="{{ download_url }}" style="display:inline-block;background:#2e7d43;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Download your file</a>
</p>
<p style="margin:0 0 16px;color:#64766b;font-size:13px;line-height:1.6;">Please keep this link private -- it is the key to your purchase, and anyone who has it can download the file.</p>
<p style="margin:0;color:#64766b;font-size:13px;line-height:1.6;">You can find all of your purchases again any time under My Account &rarr; Downloads.</p>
{{ footer }}', '[{"key": "order_id", "description": "The order number"}, {"key": "customer_name", "description": "The customer''s name"}, {"key": "product_name", "description": "The name of the digital product this link unlocks"}, {"key": "download_url", "description": "The buyer''s private, single-product download link"}, {"key": "customer_phone", "description": "The customer''s phone number"}, {"key": "product_list", "description": "Every item on the order, pre-rendered as an HTML list"}, {"key": "payment_method", "description": "The payment method used"}, {"key": "total", "description": "The order total, with currency"}]'::jsonb, 'f', 't', now(), now()) ON CONFLICT (key) DO NOTHING;
