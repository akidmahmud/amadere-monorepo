-- Coupon uses remember the buyer's phone (per-customer limit for guests) and
-- can be released when their order is cancelled/deleted.
ALTER TABLE "discount_redemptions" ADD COLUMN "phone" TEXT;
ALTER TABLE "discount_redemptions" ADD COLUMN "released_at" TIMESTAMP(3);

CREATE INDEX "discount_redemptions_discount_id_phone_idx" ON "discount_redemptions"("discount_id", "phone");
CREATE INDEX "discount_redemptions_order_id_idx" ON "discount_redemptions"("order_id");

-- Backfill: every past use gets the phone from its order's shipping address,
-- normalised to the last 10 digits.
UPDATE "discount_redemptions" r
SET "phone" = RIGHT(regexp_replace(a."phone", '\D', '', 'g'), 10)
FROM "order_addresses" a
WHERE a."order_id" = r."order_id"
  AND a."type" = 'SHIPPING'
  AND length(regexp_replace(a."phone", '\D', '', 'g')) >= 10;

-- Past uses on orders that are already cancelled or deleted stop counting,
-- and their coupons get those uses back.
UPDATE "discount_redemptions" r
SET "released_at" = NOW()
FROM "orders" o
WHERE o."id" = r."order_id" AND (o."status" = 'CANCELED' OR o."deleted_at" IS NOT NULL);

-- Only SUBTRACT the released ones: usedCount also carries uses migrated from
-- the old site that have no redemption row, so it must not be recomputed.
UPDATE "discounts" d
SET "used_count" = GREATEST(d."used_count" - rel.n, 0)
FROM (
  SELECT "discount_id", COUNT(*) AS n FROM "discount_redemptions"
  WHERE "released_at" IS NOT NULL GROUP BY "discount_id"
) rel
WHERE rel."discount_id" = d."id";
