-- CreateEnum
CREATE TYPE "BlockType" AS ENUM ('PHONE', 'EMAIL', 'IP');

-- CreateEnum
CREATE TYPE "SmsStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "AdvanceStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'WAIVED');

-- CreateEnum
CREATE TYPE "ManualPayStatus" AS ENUM ('SUBMITTED', 'VERIFIED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'CONFIRMED';
ALTER TYPE "OrderStatus" ADD VALUE 'HOLD';

-- CreateTable
CREATE TABLE "block_rules" (
    "id" SERIAL NOT NULL,
    "type" "BlockType" NOT NULL,
    "value" TEXT NOT NULL,
    "reason" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "block_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_templates" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "body_en" TEXT NOT NULL,
    "body_bn" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sms_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_logs" (
    "id" SERIAL NOT NULL,
    "to" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "template_key" TEXT,
    "status" "SmsStatus" NOT NULL DEFAULT 'QUEUED',
    "provider" TEXT NOT NULL,
    "cost" DECIMAL(10,4),
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advance_payments" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "required" DECIMAL(10,2) NOT NULL,
    "paid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "AdvanceStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advance_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_payments" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "sender_msisdn" TEXT NOT NULL,
    "trx_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "ManualPayStatus" NOT NULL DEFAULT 'SUBMITTED',
    "verified_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manual_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incomplete_orders" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER,
    "phone" TEXT,
    "email" TEXT,
    "cart" JSONB NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "stage" TEXT NOT NULL,
    "recovered" BOOLEAN NOT NULL DEFAULT false,
    "recovered_order_id" INTEGER,
    "recovery_attempts" INTEGER NOT NULL DEFAULT 0,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incomplete_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_profits" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "revenue" DECIMAL(10,2) NOT NULL,
    "cogs" DECIMAL(10,2) NOT NULL,
    "shipping" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "fees" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "ad_spend" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "net_profit" DECIMAL(10,2) NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_profits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "block_rules_type_value_key" ON "block_rules"("type", "value");

-- CreateIndex
CREATE UNIQUE INDEX "sms_templates_key_key" ON "sms_templates"("key");

-- CreateIndex
CREATE INDEX "sms_logs_status_created_at_idx" ON "sms_logs"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "advance_payments_order_id_key" ON "advance_payments"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "manual_payments_method_trx_id_key" ON "manual_payments"("method", "trx_id");

-- CreateIndex
CREATE INDEX "incomplete_orders_recovered_last_seen_at_idx" ON "incomplete_orders"("recovered", "last_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "order_profits_order_id_key" ON "order_profits"("order_id");

-- CreateIndex
CREATE INDEX "order_profits_computed_at_idx" ON "order_profits"("computed_at");

-- AddForeignKey
ALTER TABLE "advance_payments" ADD CONSTRAINT "advance_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_payments" ADD CONSTRAINT "manual_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_profits" ADD CONSTRAINT "order_profits_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
