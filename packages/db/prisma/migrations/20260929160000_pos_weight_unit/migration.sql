-- POS: weight display unit (g, kg, ml, l).
ALTER TABLE "products" ADD COLUMN "weight_unit" TEXT;
ALTER TABLE "store_prices" ADD COLUMN "weight_unit" TEXT;
