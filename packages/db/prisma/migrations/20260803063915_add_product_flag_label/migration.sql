-- CreateEnum
CREATE TYPE "ProductFlagLabel" AS ENUM ('BEST_SELLING', 'NEW_ARRIVAL', 'FEATURED');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "flag_label" "ProductFlagLabel";
