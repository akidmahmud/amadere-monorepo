-- Amadere email_templates seed
-- Seeds the 10 default email templates (base header/footer chrome, admin
-- password reset, and the ecommerce order-lifecycle set) into a fresh
-- email_templates table -- e.g. a production DB where the
-- 20260812235123_add_email_templates migration created the table but
-- never seeded any rows, so OrderEmailsService currently logs
-- "Email template '...' not found" for every order event.
--
-- Usage on the VPS:
--   psql "$DATABASE_URL" -f seed-email-templates.sql
-- or, if Postgres runs in Docker there:
--   docker exec -i <postgres-container> psql -U <user> -d <db> < seed-email-templates.sql
--
-- Safe to re-run: ON CONFLICT (key) DO NOTHING means an already-seeded
-- or admin-edited row is left untouched, never overwritten.

BEGIN;

INSERT INTO email_templates (key, "group", title, description, subject, body_html, default_subject, default_body_html, variables, can_disable, enabled, created_at, updated_at) VALUES ('core_base_header', 'BASE', 'Email template header', 'Template for header of emails', '', '<style>{{ custom_css }}</style>
<div style="background:#f5f6fa;padding:24px 0;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;">
    <div style="background:#2e7d43;padding:20px 30px;text-align:center;">
      {{ logo_html }}
    </div>
    <div style="padding:30px;color:#1e2b22;">', '', '<style>{{ custom_css }}</style>
<div style="background:#f5f6fa;padding:24px 0;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;">
    <div style="background:#2e7d43;padding:20px 30px;text-align:center;">
      {{ logo_html }}
    </div>
    <div style="padding:30px;color:#1e2b22;">', '[{"key": "logo_html", "description": "The site logo, pre-rendered as an <img> tag"}, {"key": "custom_css", "description": "Custom CSS from Email Template Settings"}]'::jsonb, 'f', 't', now(), now()) ON CONFLICT (key) DO NOTHING;
INSERT INTO email_templates (key, "group", title, description, subject, body_html, default_subject, default_body_html, variables, can_disable, enabled, created_at, updated_at) VALUES ('core_base_footer', 'BASE', 'Email template footer', 'Template for footer of emails', '', '    </div>
    <div style="padding:20px 30px;text-align:center;color:#94a69a;font-size:12px;border-top:1px solid #eef3ef;">
      {{ copyright }}
    </div>
  </div>
</div>', '', '    </div>
    <div style="padding:20px 30px;text-align:center;color:#94a69a;font-size:12px;border-top:1px solid #eef3ef;">
      {{ copyright }}
    </div>
  </div>
</div>', '[{"key": "copyright", "description": "Copyright line from Email Template Settings"}]'::jsonb, 'f', 't', now(), now()) ON CONFLICT (key) DO NOTHING;
INSERT INTO email_templates (key, "group", title, description, subject, body_html, default_subject, default_body_html, variables, can_disable, enabled, created_at, updated_at) VALUES ('admin_password_reset', 'ACL', 'Reset password', 'Send email to admin when requesting reset password', 'Reset your Amader Admin password', '{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">Reset your password</h2>
<p style="margin:0 0 20px;line-height:1.6;">Hi {{ admin_name }},</p>
<p style="margin:0 0 20px;line-height:1.6;">We received a request to reset your Amader Admin password. Click the button below to choose a new one — this link expires in 1 hour.</p>
<p style="margin:0 0 24px;text-align:center;">
  <a href="{{ reset_link }}" style="display:inline-block;background:#2e7d43;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Reset Password</a>
</p>
<p style="margin:0;color:#64766b;font-size:13px;line-height:1.6;">If you didn''t request this, you can safely ignore this email — your password won''t change.</p>
{{ footer }}', 'Reset your Amader Admin password', '{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">Reset your password</h2>
<p style="margin:0 0 20px;line-height:1.6;">Hi {{ admin_name }},</p>
<p style="margin:0 0 20px;line-height:1.6;">We received a request to reset your Amader Admin password. Click the button below to choose a new one — this link expires in 1 hour.</p>
<p style="margin:0 0 24px;text-align:center;">
  <a href="{{ reset_link }}" style="display:inline-block;background:#2e7d43;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Reset Password</a>
</p>
<p style="margin:0;color:#64766b;font-size:13px;line-height:1.6;">If you didn''t request this, you can safely ignore this email — your password won''t change.</p>
{{ footer }}', '[{"key": "admin_name", "description": "The admin''s full name"}, {"key": "reset_link", "description": "One-time password reset link"}]'::jsonb, 'f', 't', now(), now()) ON CONFLICT (key) DO NOTHING;
INSERT INTO email_templates (key, "group", title, description, subject, body_html, default_subject, default_body_html, variables, can_disable, enabled, created_at, updated_at) VALUES ('order_placed', 'ECOMMERCE', 'Order Placed', 'Send email to customer when they place an order', 'Your order {{ order_id }} has been received', '{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">Thanks for your order, {{ customer_name }}!</h2>
<p style="margin:0 0 16px;line-height:1.6;">We''ve received order <strong>{{ order_id }}</strong> and will confirm it shortly.</p>
<p style="margin:0 0 8px;font-weight:bold;color:#1e2b22;">Items</p>
{{ product_list }}
<p style="margin:16px 0 0;font-weight:bold;color:#1e2b22;">Total: {{ total }}</p>
<p style="margin:16px 0 0;color:#64766b;font-size:13px;">Payment method: {{ payment_method }}</p>
{{ footer }}', 'Your order {{ order_id }} has been received', '{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">Thanks for your order, {{ customer_name }}!</h2>
<p style="margin:0 0 16px;line-height:1.6;">We''ve received order <strong>{{ order_id }}</strong> and will confirm it shortly.</p>
<p style="margin:0 0 8px;font-weight:bold;color:#1e2b22;">Items</p>
{{ product_list }}
<p style="margin:16px 0 0;font-weight:bold;color:#1e2b22;">Total: {{ total }}</p>
<p style="margin:16px 0 0;color:#64766b;font-size:13px;">Payment method: {{ payment_method }}</p>
{{ footer }}', '[{"key": "order_id", "description": "The order number"}, {"key": "customer_name", "description": "The customer''s name"}, {"key": "customer_phone", "description": "The customer''s phone number"}, {"key": "customer_address", "description": "The shipping address"}, {"key": "product_list", "description": "The ordered items, pre-rendered as an HTML list"}, {"key": "order_note", "description": "The customer''s order note, if any"}, {"key": "payment_method", "description": "The payment method used"}, {"key": "total", "description": "The order total, with currency"}]'::jsonb, 't', 't', now(), now()) ON CONFLICT (key) DO NOTHING;
INSERT INTO email_templates (key, "group", title, description, subject, body_html, default_subject, default_body_html, variables, can_disable, enabled, created_at, updated_at) VALUES ('admin_new_order', 'ECOMMERCE', 'New Order (Admin Notice)', 'Notify staff by email when a new order is placed', 'New order {{ order_id }} received', '{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">New order {{ order_id }}</h2>
<p style="margin:0 0 4px;"><strong>Customer:</strong> {{ customer_name }} ({{ customer_phone }})</p>
<p style="margin:0 0 16px;"><strong>Address:</strong> {{ customer_address }}</p>
<p style="margin:0 0 8px;font-weight:bold;color:#1e2b22;">Items</p>
{{ product_list }}
<p style="margin:16px 0 0;font-weight:bold;color:#1e2b22;">Total: {{ total }}</p>
<p style="margin:16px 0 0;color:#64766b;font-size:13px;">Payment method: {{ payment_method }}</p>
{{ footer }}', 'New order {{ order_id }} received', '{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">New order {{ order_id }}</h2>
<p style="margin:0 0 4px;"><strong>Customer:</strong> {{ customer_name }} ({{ customer_phone }})</p>
<p style="margin:0 0 16px;"><strong>Address:</strong> {{ customer_address }}</p>
<p style="margin:0 0 8px;font-weight:bold;color:#1e2b22;">Items</p>
{{ product_list }}
<p style="margin:16px 0 0;font-weight:bold;color:#1e2b22;">Total: {{ total }}</p>
<p style="margin:16px 0 0;color:#64766b;font-size:13px;">Payment method: {{ payment_method }}</p>
{{ footer }}', '[{"key": "order_id", "description": "The order number"}, {"key": "customer_name", "description": "The customer''s name"}, {"key": "customer_phone", "description": "The customer''s phone number"}, {"key": "customer_address", "description": "The shipping address"}, {"key": "product_list", "description": "The ordered items, pre-rendered as an HTML list"}, {"key": "order_note", "description": "The customer''s order note, if any"}, {"key": "payment_method", "description": "The payment method used"}, {"key": "total", "description": "The order total, with currency"}]'::jsonb, 't', 't', now(), now()) ON CONFLICT (key) DO NOTHING;
INSERT INTO email_templates (key, "group", title, description, subject, body_html, default_subject, default_body_html, variables, can_disable, enabled, created_at, updated_at) VALUES ('order_confirmed', 'ECOMMERCE', 'Order Confirmed', 'Send to customer when their order is confirmed', 'Your order {{ order_id }} has been confirmed', '{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">Your order is confirmed</h2>
<p style="margin:0 0 16px;line-height:1.6;">Hi {{ customer_name }}, order <strong>{{ order_id }}</strong> has been confirmed and is being prepared.</p>
{{ product_list }}
<p style="margin:16px 0 0;font-weight:bold;color:#1e2b22;">Total: {{ total }}</p>
{{ footer }}', 'Your order {{ order_id }} has been confirmed', '{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">Your order is confirmed</h2>
<p style="margin:0 0 16px;line-height:1.6;">Hi {{ customer_name }}, order <strong>{{ order_id }}</strong> has been confirmed and is being prepared.</p>
{{ product_list }}
<p style="margin:16px 0 0;font-weight:bold;color:#1e2b22;">Total: {{ total }}</p>
{{ footer }}', '[{"key": "order_id", "description": "The order number"}, {"key": "customer_name", "description": "The customer''s name"}, {"key": "customer_phone", "description": "The customer''s phone number"}, {"key": "customer_address", "description": "The shipping address"}, {"key": "product_list", "description": "The ordered items, pre-rendered as an HTML list"}, {"key": "order_note", "description": "The customer''s order note, if any"}, {"key": "payment_method", "description": "The payment method used"}, {"key": "total", "description": "The order total, with currency"}]'::jsonb, 't', 't', now(), now()) ON CONFLICT (key) DO NOTHING;
INSERT INTO email_templates (key, "group", title, description, subject, body_html, default_subject, default_body_html, variables, can_disable, enabled, created_at, updated_at) VALUES ('order_canceled', 'ECOMMERCE', 'Order Canceled', 'Send to customer when their order is canceled', 'Your order {{ order_id }} has been canceled', '{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">Your order has been canceled</h2>
<p style="margin:0 0 16px;line-height:1.6;">Hi {{ customer_name }}, order <strong>{{ order_id }}</strong> has been canceled.</p>
<p style="margin:0 0 16px;color:#64766b;"><strong>Reason:</strong> {{ cancellation_reason }}</p>
{{ product_list }}
{{ footer }}', 'Your order {{ order_id }} has been canceled', '{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">Your order has been canceled</h2>
<p style="margin:0 0 16px;line-height:1.6;">Hi {{ customer_name }}, order <strong>{{ order_id }}</strong> has been canceled.</p>
<p style="margin:0 0 16px;color:#64766b;"><strong>Reason:</strong> {{ cancellation_reason }}</p>
{{ product_list }}
{{ footer }}', '[{"key": "order_id", "description": "The order number"}, {"key": "customer_name", "description": "The customer''s name"}, {"key": "customer_phone", "description": "The customer''s phone number"}, {"key": "customer_address", "description": "The shipping address"}, {"key": "product_list", "description": "The ordered items, pre-rendered as an HTML list"}, {"key": "cancellation_reason", "description": "Why the order was canceled"}, {"key": "total", "description": "The order total, with currency"}]'::jsonb, 't', 't', now(), now()) ON CONFLICT (key) DO NOTHING;
INSERT INTO email_templates (key, "group", title, description, subject, body_html, default_subject, default_body_html, variables, can_disable, enabled, created_at, updated_at) VALUES ('order_shipped', 'ECOMMERCE', 'Order Shipped', 'Send to customer when their order is dispatched to a courier', 'Your order {{ order_id }} is on its way', '{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">Your order is on its way!</h2>
<p style="margin:0 0 16px;line-height:1.6;">Hi {{ customer_name }}, order <strong>{{ order_id }}</strong> has been handed to our courier.</p>
<p style="margin:0 0 4px;"><strong>Tracking ID:</strong> {{ tracking_id }}</p>
<p style="margin:0 0 16px;">Track it any time at <a href="{{ tracking_link }}">{{ tracking_link }}</a>.</p>
{{ product_list }}
{{ footer }}', 'Your order {{ order_id }} is on its way', '{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">Your order is on its way!</h2>
<p style="margin:0 0 16px;line-height:1.6;">Hi {{ customer_name }}, order <strong>{{ order_id }}</strong> has been handed to our courier.</p>
<p style="margin:0 0 4px;"><strong>Tracking ID:</strong> {{ tracking_id }}</p>
<p style="margin:0 0 16px;">Track it any time at <a href="{{ tracking_link }}">{{ tracking_link }}</a>.</p>
{{ product_list }}
{{ footer }}', '[{"key": "order_id", "description": "The order number"}, {"key": "customer_name", "description": "The customer''s name"}, {"key": "customer_phone", "description": "The customer''s phone number"}, {"key": "customer_address", "description": "The shipping address"}, {"key": "product_list", "description": "The ordered items, pre-rendered as an HTML list"}, {"key": "tracking_id", "description": "The courier tracking code"}, {"key": "tracking_link", "description": "Link to the storefront order-tracking page"}, {"key": "total", "description": "The order total, with currency"}]'::jsonb, 't', 't', now(), now()) ON CONFLICT (key) DO NOTHING;
INSERT INTO email_templates (key, "group", title, description, subject, body_html, default_subject, default_body_html, variables, can_disable, enabled, created_at, updated_at) VALUES ('order_delivered', 'ECOMMERCE', 'Order Delivered', 'Send to customer when their order is delivered', 'Your order {{ order_id }} has been delivered', '{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">Your order has arrived!</h2>
<p style="margin:0 0 16px;line-height:1.6;">Hi {{ customer_name }}, order <strong>{{ order_id }}</strong> has been delivered. We hope you love it!</p>
{{ product_list }}
{{ footer }}', 'Your order {{ order_id }} has been delivered', '{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">Your order has arrived!</h2>
<p style="margin:0 0 16px;line-height:1.6;">Hi {{ customer_name }}, order <strong>{{ order_id }}</strong> has been delivered. We hope you love it!</p>
{{ product_list }}
{{ footer }}', '[{"key": "order_id", "description": "The order number"}, {"key": "customer_name", "description": "The customer''s name"}, {"key": "customer_phone", "description": "The customer''s phone number"}, {"key": "customer_address", "description": "The shipping address"}, {"key": "product_list", "description": "The ordered items, pre-rendered as an HTML list"}, {"key": "total", "description": "The order total, with currency"}]'::jsonb, 't', 't', now(), now()) ON CONFLICT (key) DO NOTHING;
INSERT INTO email_templates (key, "group", title, description, subject, body_html, default_subject, default_body_html, variables, can_disable, enabled, created_at, updated_at) VALUES ('payment_confirmed', 'ECOMMERCE', 'Payment Confirmed', 'Send to customer when their manual payment is verified', 'We''ve received your payment for order {{ order_id }}', '{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">Payment received</h2>
<p style="margin:0 0 16px;line-height:1.6;">Hi {{ customer_name }}, we''ve confirmed your payment for order <strong>{{ order_id }}</strong>.</p>
<p style="margin:0 0 8px;font-weight:bold;color:#1e2b22;">Amount paid: {{ payment_amount }}</p>
<p style="margin:0 0 16px;color:#64766b;">Order total: {{ total }}</p>
{{ footer }}', 'We''ve received your payment for order {{ order_id }}', '{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">Payment received</h2>
<p style="margin:0 0 16px;line-height:1.6;">Hi {{ customer_name }}, we''ve confirmed your payment for order <strong>{{ order_id }}</strong>.</p>
<p style="margin:0 0 8px;font-weight:bold;color:#1e2b22;">Amount paid: {{ payment_amount }}</p>
<p style="margin:0 0 16px;color:#64766b;">Order total: {{ total }}</p>
{{ footer }}', '[{"key": "order_id", "description": "The order number"}, {"key": "customer_name", "description": "The customer''s name"}, {"key": "customer_phone", "description": "The customer''s phone number"}, {"key": "customer_address", "description": "The shipping address"}, {"key": "product_list", "description": "The ordered items, pre-rendered as an HTML list"}, {"key": "payment_amount", "description": "The amount actually paid in this payment, with currency (may be less than the order total for a partial/advance payment)"}, {"key": "total", "description": "The order''s overall total, with currency"}]'::jsonb, 't', 't', now(), now()) ON CONFLICT (key) DO NOTHING;

COMMIT;
