-- Exchange per line: an Exchange order can also carry ordinary paid items.
ALTER TABLE "order_items" ADD COLUMN "is_exchange" BOOLEAN NOT NULL DEFAULT false;
-- Exchange orders made before this were replacement-only: every line is one.
UPDATE "order_items" SET "is_exchange" = true
WHERE "order_id" IN (SELECT "id" FROM "orders" WHERE "exchange_of_order_id" IS NOT NULL);
