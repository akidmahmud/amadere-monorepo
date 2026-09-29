-- POS per-item returns: refunded money/VAT per order; returned qty per line
-- lives in order_items.restocked_quantity (previously unused).
ALTER TABLE "orders" ADD COLUMN "pos_refunded_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "pos_refunded_vat" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Sales already returned in full (not via delete) keep their figures.
UPDATE "orders" SET "pos_refunded_amount" = "total_amount", "pos_refunded_vat" = "tax_amount"
WHERE "channel" = 'POS' AND "status" = 'RETURNED' AND NOT "pos_voided_by_delete";
UPDATE "order_items" oi SET "restocked_quantity" = oi."quantity"
FROM "orders" o WHERE o."id" = oi."order_id" AND o."channel" = 'POS'
AND o."status" = 'RETURNED' AND NOT o."pos_voided_by_delete";
