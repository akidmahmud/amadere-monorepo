-- POS: products sold by weight, and the weight sold on each sale line.
ALTER TABLE "products" ADD COLUMN "sold_by_weight" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "order_items" ADD COLUMN "weighed_kg" DECIMAL(10,3);
