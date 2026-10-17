-- POS sold by weight: the per-kg rate each weighed line was priced at.
ALTER TABLE "order_items" ADD COLUMN "price_per_kg" DECIMAL(10,2);
