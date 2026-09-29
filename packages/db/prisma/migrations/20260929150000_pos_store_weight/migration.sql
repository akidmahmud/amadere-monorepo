-- POS: a store's own product weight (receipt).
ALTER TABLE "store_prices" ADD COLUMN "weight_kg" DECIMAL(10,3);
