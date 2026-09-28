-- POS: a store's own product name; price becomes optional (name-only rows).
ALTER TABLE "store_prices" ADD COLUMN "name" TEXT;
ALTER TABLE "store_prices" ALTER COLUMN "price" DROP NOT NULL;
-- An offer price only makes sense on top of a store price.
ALTER TABLE "store_prices" ADD CONSTRAINT "store_prices_sale_needs_price" CHECK ("sale_price" IS NULL OR "price" IS NOT NULL);
