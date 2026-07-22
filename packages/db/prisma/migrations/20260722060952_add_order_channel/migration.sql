-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('WEBSITE', 'WHATSAPP', 'PHONE', 'MARKETPLACE', 'POS', 'APP');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "channel" "OrderChannel" NOT NULL DEFAULT 'WEBSITE';
