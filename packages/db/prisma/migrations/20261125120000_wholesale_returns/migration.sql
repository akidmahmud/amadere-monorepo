-- Wholesale returns: per-line returned quantity, the order's returned value,
-- and one row per return (what came back, its value, any refund).
ALTER TABLE "wholesale_orders" ADD COLUMN "returned_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "wholesale_order_items" ADD COLUMN "returned_qty" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "wholesale_returns" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "items" JSONB NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "refunded" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refund_account_id" INTEGER,
    "note" TEXT,
    "created_by_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wholesale_returns_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "wholesale_returns_order_id_idx" ON "wholesale_returns"("order_id");
ALTER TABLE "wholesale_returns" ADD CONSTRAINT "wholesale_returns_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "wholesale_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
