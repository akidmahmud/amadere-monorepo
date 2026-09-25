-- POS Phase 1.1: return date + cash tendered on orders, per-store invoice templates.

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "returned_at" TIMESTAMP(3),
ADD COLUMN     "tendered_amount" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "pos_invoice_templates" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER,
    "html" TEXT NOT NULL,
    "updated_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_invoice_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pos_invoice_templates_store_id_key" ON "pos_invoice_templates"("store_id");

-- AddForeignKey
ALTER TABLE "pos_invoice_templates" ADD CONSTRAINT "pos_invoice_templates_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written: a unique index treats NULLs as distinct, so this keeps the
-- Default template (store_id NULL) to a single row.
CREATE UNIQUE INDEX "pos_invoice_templates_one_default" ON "pos_invoice_templates" ((store_id IS NULL)) WHERE store_id IS NULL;

-- Existing returned POS orders: best available return date.
UPDATE "orders" SET "returned_at" = "updated_at" WHERE "status" = 'RETURNED' AND "returned_at" IS NULL;
