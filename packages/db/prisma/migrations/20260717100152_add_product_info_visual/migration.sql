-- AlterTable
ALTER TABLE "product_translations" ADD COLUMN     "info_visual_content" JSONB;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "info_visual_images" JSONB;
