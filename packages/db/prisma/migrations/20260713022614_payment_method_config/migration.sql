-- CreateEnum
CREATE TYPE "PaymentAccountType" AS ENUM ('PERSONAL', 'AGENT', 'MERCHANT');

-- AlterEnum
ALTER TYPE "PaymentProvider" ADD VALUE 'UPAY';

-- CreateTable
CREATE TABLE "payment_method_configs" (
    "id" SERIAL NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "account_type" "PaymentAccountType" NOT NULL DEFAULT 'PERSONAL',
    "number" TEXT NOT NULL,
    "instructions_en" TEXT,
    "instructions_bn" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_method_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_method_configs_provider_key" ON "payment_method_configs"("provider");
