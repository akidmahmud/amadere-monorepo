-- AlterTable
ALTER TABLE "product_translations" DROP COLUMN "comparison_content",
DROP COLUMN "info_visual_content",
DROP COLUMN "ingredients",
DROP COLUMN "nutrition",
ADD COLUMN     "benefit_points" TEXT,
ADD COLUMN     "comparison_table" JSONB,
ADD COLUMN     "how_to_use" TEXT;

-- AlterTable
ALTER TABLE "products" DROP COLUMN "comparison_images",
DROP COLUMN "info_visual_images";

