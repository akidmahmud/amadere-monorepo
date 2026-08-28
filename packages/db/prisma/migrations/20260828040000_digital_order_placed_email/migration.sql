-- A digital-only order gets its own order-placed email.
--
-- `order_placed` is written for a parcel: it promises to "confirm it
-- shortly", shows a payment method, and heads a COD delivery lifecycle. None
-- of that is true of a PDF, which is paid for and available the moment
-- checkout finishes. OrderEmailsService.sendOrderPlaced now picks between the
-- two by whether every line is DIGITAL.
--
-- can_disable = 'f', same as digital_download: turning this off would leave a
-- digital buyer with no order record at all in their inbox.
--
-- ON CONFLICT DO NOTHING so re-running is safe and never clobbers wording an
-- admin has since edited.
-- Hand-written + `migrate deploy`: `prisma migrate dev` cannot run in this
-- repo (pre-existing FK violation in 20260807103916_promo_videos_standalone).
INSERT INTO email_templates (
  key, "group", title, description,
  subject, body_html, default_subject, default_body_html,
  variables, can_disable, enabled, created_at, updated_at
) VALUES (
  'digital_order_placed',
  'ECOMMERCE',
  'Order Placed (Digital)',
  'Sent instead of "Order Placed" when every item on the order is a digital product',
  'Your order {{ order_id }} is ready to download',
  '{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">Thanks, {{ customer_name }} — your order is complete.</h2>
<p style="margin:0 0 20px;line-height:1.6;">Order <strong>{{ order_id }}</strong> is confirmed. There is nothing to ship and nothing left to pay: your files are available right now.</p>
<h3 style="margin:0 0 8px;color:#1e2b22;font-size:15px;">Your purchase</h3>
{{ product_list }}
<p style="margin:16px 0 24px;"><strong>Total paid: {{ total }}</strong></p>
<p style="margin:0 0 24px;text-align:center;">
  <a href="{{ downloads_url }}" style="display:inline-block;background:#2e7d43;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Read or download</a>
</p>
<p style="margin:0;color:#64766b;font-size:13px;line-height:1.6;">Your purchases stay in My Account &rarr; Downloads, so you can come back to them any time. A separate email carries the direct download link for each file.</p>
{{ footer }}',
  'Your order {{ order_id }} is ready to download',
  '{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">Thanks, {{ customer_name }} — your order is complete.</h2>
<p style="margin:0 0 20px;line-height:1.6;">Order <strong>{{ order_id }}</strong> is confirmed. There is nothing to ship and nothing left to pay: your files are available right now.</p>
<h3 style="margin:0 0 8px;color:#1e2b22;font-size:15px;">Your purchase</h3>
{{ product_list }}
<p style="margin:16px 0 24px;"><strong>Total paid: {{ total }}</strong></p>
<p style="margin:0 0 24px;text-align:center;">
  <a href="{{ downloads_url }}" style="display:inline-block;background:#2e7d43;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Read or download</a>
</p>
<p style="margin:0;color:#64766b;font-size:13px;line-height:1.6;">Your purchases stay in My Account &rarr; Downloads, so you can come back to them any time. A separate email carries the direct download link for each file.</p>
{{ footer }}',
  '[{"key": "order_id", "description": "The order number"}, {"key": "customer_name", "description": "The customer''s name"}, {"key": "customer_phone", "description": "The customer''s phone number"}, {"key": "product_list", "description": "Every item on the order, pre-rendered as an HTML list"}, {"key": "total", "description": "The order total, with currency"}, {"key": "downloads_url", "description": "Link to My Account > Downloads"}]'::jsonb,
  'f', 't', now(), now()
) ON CONFLICT (key) DO NOTHING;
