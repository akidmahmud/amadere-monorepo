-- POS customer import: the store a customer was imported into.
ALTER TABLE "customers" ADD COLUMN "pos_store_id" INTEGER;

CREATE INDEX "customers_pos_store_id_idx" ON "customers"("pos_store_id");

ALTER TABLE "customers" ADD CONSTRAINT "customers_pos_store_id_fkey" FOREIGN KEY ("pos_store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
