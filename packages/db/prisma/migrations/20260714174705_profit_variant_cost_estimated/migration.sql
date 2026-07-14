-- AlterTable
ALTER TABLE "order_profits" ADD COLUMN     "has_estimated_cost" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "cost_per_item" DECIMAL(10,2);
