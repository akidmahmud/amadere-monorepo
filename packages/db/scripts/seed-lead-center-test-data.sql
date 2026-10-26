-- Lead Center test data (local only). Three open leads to work with, plus
-- converted / lost history so the dashboard has numbers. Marked "(Seed)".
BEGIN;
-- 1) Phone only, brand new (WhatsApp)
INSERT INTO leads (phone, lead_source, lead_date, interested_product, priority, status, created_at, updated_at)
VALUES ('8801711000001', 'WhatsApp', current_date - 1, 'Sorishar tel 5 ltr', 'HIGH', 'NEW', now() - interval '1 day', now());
-- 2) Named, interested, call due today
INSERT INTO leads (phone, name, lead_source, lead_date, interested_product, assigned_admin_id, priority, status, next_call_date, last_call_at, customer_feedback, created_at, updated_at)
VALUES ('8801711000002', 'Shirin Akter (Seed)', 'Inbound call', current_date - 4, 'Kalojira modhu 500g', 1, 'HIGH', 'INTERESTED', current_date, now() - interval '1 day', 'Wants honey for her mother; asked about 1 kg price', now() - interval '4 days', now());
-- 3) Named, call back later, next call tomorrow
INSERT INTO leads (phone, name, lead_source, lead_date, interested_product, assigned_admin_id, priority, status, next_call_date, last_call_at, address_line, district, area, created_at, updated_at)
VALUES ('8801711000003', 'Rafiq Uddin (Seed)', 'Facebook', current_date - 6, 'Gawa ghee 1 kg', 1, 'MEDIUM', 'FOLLOW_UP', current_date + 1, now() - interval '2 days', 'Flat 4B, Road 11', 'Dhaka', 'Mirpur', now() - interval '6 days', now());

INSERT INTO lead_call_logs (lead_id, outcome, notes, author_admin_id, created_at)
SELECT id, 'NO_ANSWER'::"LeadCallOutcome", NULL::text, 1, now() - interval '3 days' FROM leads WHERE phone = '8801711000002'
UNION ALL SELECT id, 'ANSWERED_INTERESTED'::"LeadCallOutcome", 'Price sent on WhatsApp', 1, now() - interval '1 day' FROM leads WHERE phone = '8801711000002'
UNION ALL SELECT id, 'BUSY'::"LeadCallOutcome", NULL::text, 1, now() - interval '5 days' FROM leads WHERE phone = '8801711000003'
UNION ALL SELECT id, 'ANSWERED_CALL_BACK'::"LeadCallOutcome", 'Call after salary day', 1, now() - interval '2 days' FROM leads WHERE phone = '8801711000003';

-- History for the dashboard: three converted leads (hidden from the list,
-- linked to the latest real orders) ...
INSERT INTO leads (phone, name, lead_source, lead_date, interested_product, assigned_admin_id, priority, status,
                   converted_customer_id, converted_order_id, converted_at, created_at, updated_at)
SELECT '88017110001' || n, 'Converted lead ' || n || ' (Seed)', src, current_date - (n * 3 + 2)::int, 'Seed product', 1, 'HIGH', 'CONVERTED',
       o.customer_id, o.id, now() - (n * 3 || ' days')::interval, now() - ((n * 3 + 2) || ' days')::interval, now()
FROM (SELECT o.id, o.customer_id, row_number() OVER (ORDER BY o.created_at DESC) AS n
      FROM orders o WHERE o.deleted_at IS NULL AND o.channel <> 'POS' AND o.customer_id IS NOT NULL AND o.status <> 'CANCELED'
      ORDER BY o.created_at DESC LIMIT 3) o
JOIN (VALUES (1, 'Inbound call'), (2, 'WhatsApp'), (3, 'Inbound call')) s(k, src) ON s.k = o.n;

INSERT INTO lead_call_logs (lead_id, outcome, notes, author_admin_id, created_at)
SELECT l.id, x.outcome::"LeadCallOutcome", NULL, 1, l.converted_at - x.ago
FROM leads l
CROSS JOIN (VALUES ('NO_ANSWER', interval '2 days'), ('ANSWERED_INTERESTED', interval '1 day'), ('ORDER_PLACED', interval '5 minutes')) x(outcome, ago)
WHERE l.name LIKE 'Converted lead % (Seed)';

-- ... a lost lead and a do-not-call lead ...
INSERT INTO leads (phone, name, lead_source, lead_date, interested_product, assigned_admin_id, priority, status, lost_reason, last_call_at, created_at, updated_at)
VALUES ('8801711000201', 'Lost lead (Seed)', 'Inbound call', current_date - 9, 'Chia seeds', 1, 'LOW', 'LOST', 'Price too high', now() - interval '8 days', now() - interval '9 days', now() - interval '8 days'),
       ('8801711000202', 'Do-not-call lead (Seed)', 'WhatsApp', current_date - 12, NULL, 1, 'LOW', 'DNC', NULL, now() - interval '11 days', now() - interval '12 days', now() - interval '11 days');
INSERT INTO lead_call_logs (lead_id, outcome, notes, author_admin_id, created_at)
SELECT id, 'NOT_INTERESTED'::"LeadCallOutcome", 'Said it is too expensive', 1, now() - interval '8 days' FROM leads WHERE phone = '8801711000201'
UNION ALL SELECT id, 'DO_NOT_CALL'::"LeadCallOutcome", 'Asked not to be called again', 1, now() - interval '11 days' FROM leads WHERE phone = '8801711000202'
UNION ALL SELECT id, 'NUMBER_OFF'::"LeadCallOutcome", NULL::text, 1, now() - interval '13 days' FROM leads WHERE phone = '8801711000202'
UNION ALL SELECT id, 'WRONG_NUMBER'::"LeadCallOutcome", NULL::text, 1, now() - interval '7 days' FROM leads WHERE phone = '8801711000201';

-- ... and customer follow-up calls spread over the last two weeks.
INSERT INTO customer_call_logs (customer_id, phone_called, outcome, notes, author_admin_id, created_at)
SELECT c.id, c.phone, (ARRAY['CONNECTED','NO_ANSWER','CONNECTED','DECLINED','CONNECTED'])[1 + (g % 5)]::"CallOutcome",
       'Seed follow-up call', 1, now() - (g || ' days')::interval - ((g * 37 % 600) || ' minutes')::interval
FROM generate_series(0, 13) g
CROSS JOIN LATERAL (SELECT id, phone FROM customers WHERE deleted_at IS NULL AND phone IS NOT NULL ORDER BY id DESC OFFSET (g % 7)::int LIMIT 1 + (g % 3)::int) c;
COMMIT;
SELECT status, count(*) FROM leads GROUP BY status ORDER BY status;
SELECT count(*) AS lead_calls FROM lead_call_logs;
SELECT count(*) AS seed_customer_calls FROM customer_call_logs WHERE notes = 'Seed follow-up call';
