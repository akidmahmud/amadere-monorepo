-- AlterTable
ALTER TABLE "product_translations" ADD COLUMN     "comparison_content" JSONB;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "comparison_images" JSONB;
