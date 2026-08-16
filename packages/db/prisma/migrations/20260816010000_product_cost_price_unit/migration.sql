-- CreateEnum
CREATE TYPE "CostPriceUnit" AS ENUM ('PER_KG', 'PER_100G', 'PER_G');

-- AlterTable
ALTER TABLE "products" ADD COLUMN "cost_price_unit" "CostPriceUnit";
