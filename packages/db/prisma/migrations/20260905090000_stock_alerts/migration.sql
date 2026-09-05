-- "Tell me when this is back" — one row per browser, per product.
CREATE TABLE "stock_alerts" (
  "id"          SERIAL PRIMARY KEY,
  "product_id"  INTEGER NOT NULL,
  -- Null for a simple product.
  "variant_id"  INTEGER,
  "endpoint"    TEXT NOT NULL,
  "customer_id" INTEGER,
  "locale"      TEXT NOT NULL DEFAULT 'EN',
  -- Kept rather than deleted once sent, so "how many were waiting" stays
  -- answerable.
  "notified_at" TIMESTAMP(3),
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- NULLS NOT DISTINCT (Postgres 15+) is what makes this work for simple
-- products: without it two rows with variant_id NULL would both be allowed and
-- one browser could register twice for the same product, then be notified twice.
CREATE UNIQUE INDEX "stock_alerts_endpoint_product_variant_key"
  ON "stock_alerts"("endpoint", "product_id", "variant_id") NULLS NOT DISTINCT;

CREATE INDEX "stock_alerts_product_id_notified_at_idx" ON "stock_alerts"("product_id", "notified_at");
CREATE INDEX "stock_alerts_notified_at_idx" ON "stock_alerts"("notified_at");

ALTER TABLE "stock_alerts"
  ADD CONSTRAINT "stock_alerts_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_alerts"
  ADD CONSTRAINT "stock_alerts_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
