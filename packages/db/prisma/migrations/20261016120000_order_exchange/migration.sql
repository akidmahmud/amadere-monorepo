-- Website order exchanges and damaged-return write-offs.
ALTER TABLE "orders" ADD COLUMN "exchange_of_order_id" INTEGER;
CREATE INDEX "orders_exchange_of_order_id_idx" ON "orders"("exchange_of_order_id");
ALTER TABLE "orders" ADD CONSTRAINT "orders_exchange_of_order_id_fkey" FOREIGN KEY ("exchange_of_order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD COLUMN "written_off_quantity" INTEGER NOT NULL DEFAULT 0;
