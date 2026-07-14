-- CreateEnum
CREATE TYPE "BlockSource" AS ENUM ('MANUAL', 'AUTO');

-- AlterEnum
ALTER TYPE "BlockType" ADD VALUE 'DEVICE';

-- AlterTable
ALTER TABLE "block_rules" ADD COLUMN     "address_text" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "customer_name" TEXT,
ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "source" "BlockSource" NOT NULL DEFAULT 'MANUAL';

-- CreateIndex
CREATE INDEX "block_rules_is_active_idx" ON "block_rules"("is_active");

-- CreateIndex
CREATE INDEX "block_rules_source_idx" ON "block_rules"("source");

-- CreateIndex
CREATE INDEX "block_rules_expires_at_idx" ON "block_rules"("expires_at");
