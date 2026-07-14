-- AlterTable
ALTER TABLE "otps" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ip_address" TEXT,
ADD COLUMN     "is_vpn" BOOLEAN NOT NULL DEFAULT false;
