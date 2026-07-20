-- CreateEnum
CREATE TYPE "CustomerNoteType" AS ENUM ('CUSTOMER_FEEDBACK', 'INTERNAL_NOTE', 'REMARK');

-- CreateEnum
CREATE TYPE "CallOutcome" AS ENUM ('CONNECTED', 'NO_ANSWER', 'VOICEMAIL', 'WRONG_NUMBER', 'DECLINED');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "completed_order_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tier_id" INTEGER;

-- CreateTable
CREATE TABLE "customer_tiers" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "min_completed_orders" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_notes" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "type" "CustomerNoteType" NOT NULL,
    "body" TEXT NOT NULL,
    "author_admin_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_call_logs" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "phone_called" TEXT NOT NULL,
    "outcome" "CallOutcome" NOT NULL,
    "notes" TEXT,
    "author_admin_id" INTEGER NOT NULL,
    "provider_call_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_tiers_min_completed_orders_key" ON "customer_tiers"("min_completed_orders");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "customer_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_author_admin_id_fkey" FOREIGN KEY ("author_admin_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_call_logs" ADD CONSTRAINT "customer_call_logs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_call_logs" ADD CONSTRAINT "customer_call_logs_author_admin_id_fkey" FOREIGN KEY ("author_admin_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
