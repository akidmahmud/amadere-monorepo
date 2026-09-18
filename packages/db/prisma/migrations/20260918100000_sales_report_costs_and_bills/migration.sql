-- Sales report (spec 2026-09-18): dated product costs + per-parcel courier bills.

CREATE TABLE "product_cost_history" (
  "id" SERIAL NOT NULL,
  "product_id" INTEGER NOT NULL,
  "variant_id" INTEGER,
  "scope_key" TEXT NOT NULL,
  "cost" DECIMAL(10,2) NOT NULL,
  "cost_price_unit" "CostPriceUnit",
  "effective_from" DATE NOT NULL,
  "confirmed" BOOLEAN NOT NULL DEFAULT true,
  "created_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_cost_history_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_cost_history_scope_key_effective_from_key"
  ON "product_cost_history"("scope_key", "effective_from");
CREATE INDEX "product_cost_history_product_id_idx" ON "product_cost_history"("product_id");

ALTER TABLE "product_cost_history"
  ADD CONSTRAINT "product_cost_history_product_id_fkey" FOREIGN KEY ("product_id")
  REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_cost_history"
  ADD CONSTRAINT "product_cost_history_variant_id_fkey" FOREIGN KEY ("variant_id")
  REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shipments" ADD COLUMN "billed_charge" DECIMAL(10,2);
ALTER TABLE "shipments" ADD COLUMN "billed_at" TIMESTAMP(3);
ALTER TABLE "shipments" ADD COLUMN "bill_import_ref" TEXT;

-- Backfill (spec D8): every cost already entered becomes one CONFIRMED row,
-- effective from the earliest order date, so every past order finds it.
WITH first_day AS (
  SELECT COALESCE(MIN("created_at")::date, CURRENT_DATE) AS d FROM "orders"
)
INSERT INTO "product_cost_history" ("product_id", "variant_id", "scope_key", "cost", "cost_price_unit", "effective_from", "confirmed")
SELECT p."id", NULL, 'p:' || p."id", p."cost_per_item", p."cost_price_unit", first_day.d, true
FROM "products" p, first_day
WHERE p."cost_per_item" IS NOT NULL
ON CONFLICT DO NOTHING;

WITH first_day AS (
  SELECT COALESCE(MIN("created_at")::date, CURRENT_DATE) AS d FROM "orders"
)
INSERT INTO "product_cost_history" ("product_id", "variant_id", "scope_key", "cost", "effective_from", "confirmed")
SELECT v."product_id", v."id", 'v:' || v."id", v."cost_per_item", first_day.d, true
FROM "product_variants" v, first_day
WHERE v."cost_per_item" IS NOT NULL
ON CONFLICT DO NOTHING;
