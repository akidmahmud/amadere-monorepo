-- A shipment now belongs to a retail order OR a wholesale order (Steadfast
-- booking from the wholesale panel).
ALTER TABLE "shipments" ALTER COLUMN "order_id" DROP NOT NULL;
ALTER TABLE "shipments" ADD COLUMN "wholesale_order_id" INTEGER;

CREATE INDEX "shipments_wholesale_order_id_idx" ON "shipments"("wholesale_order_id");

ALTER TABLE "shipments" ADD CONSTRAINT "shipments_wholesale_order_id_fkey"
  FOREIGN KEY ("wholesale_order_id") REFERENCES "wholesale_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shipments" ADD CONSTRAINT "shipments_one_parent_chk"
  CHECK (("order_id" IS NULL) <> ("wholesale_order_id" IS NULL));
