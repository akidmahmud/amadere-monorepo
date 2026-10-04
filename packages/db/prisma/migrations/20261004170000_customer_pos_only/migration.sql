-- POS shop customers stay out of the website Customer Manager.
ALTER TABLE "customers" ADD COLUMN "pos_only" BOOLEAN NOT NULL DEFAULT false;

-- Existing walk-ins: bought only at a POS shop, no website order, no login.
UPDATE "customers" c SET "pos_only" = true
WHERE EXISTS (SELECT 1 FROM "orders" o WHERE o."customer_id" = c."id" AND o."channel" = 'POS')
  AND NOT EXISTS (SELECT 1 FROM "orders" o WHERE o."customer_id" = c."id" AND o."channel" <> 'POS')
  AND c."password_hash" IS NULL
  AND c."phone_verified_at" IS NULL
  AND c."email_verified_at" IS NULL;
