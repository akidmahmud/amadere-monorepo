-- A bKash-paid website order now stays PENDING (payment shows "Paid");
-- staff confirm it. Still changeable in Net Profit > Payments.
UPDATE "payment_method_configs" SET "order_status_after_verify" = 'PENDING' WHERE "provider" = 'BKASH';
