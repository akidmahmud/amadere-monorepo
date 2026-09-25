-- POS coupons: a channel (ALL keeps every existing coupon working as before)
-- and an optional store for store-only codes.

-- CreateEnum
CREATE TYPE "DiscountChannel" AS ENUM ('ALL', 'POS');

-- AlterTable
ALTER TABLE "discounts" ADD COLUMN     "channel" "DiscountChannel" NOT NULL DEFAULT 'ALL',
ADD COLUMN     "store_id" INTEGER;

-- AddForeignKey
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
