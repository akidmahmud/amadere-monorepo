-- CreateEnum
CREATE TYPE "UpsellTriggerType" AS ENUM ('ITEM_COUNT', 'ORDER_AMOUNT');

-- CreateTable
CREATE TABLE "upsell_stages" (
    "id" SERIAL NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "trigger_type" "UpsellTriggerType" NOT NULL,
    "trigger_value" DECIMAL(10,2) NOT NULL,
    "discount_percent" DECIMAL(5,2),
    "discount_fixed_amount" DECIMAL(10,2),
    "free_shipping" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upsell_stages_pkey" PRIMARY KEY ("id")
);
