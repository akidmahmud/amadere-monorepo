-- AlterTable
ALTER TABLE "incomplete_orders" ADD COLUMN "cart_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "incomplete_orders_cart_id_key" ON "incomplete_orders"("cart_id");
