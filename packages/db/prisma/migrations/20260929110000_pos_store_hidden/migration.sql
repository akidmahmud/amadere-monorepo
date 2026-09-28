-- POS: remove a shared product from one store only.
ALTER TABLE "store_prices" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
