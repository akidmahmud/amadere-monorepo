-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "landing_domain" TEXT,
ADD COLUMN     "landing_page" TEXT,
ADD COLUMN     "referrer_domain" TEXT,
ADD COLUMN     "referrer_url" TEXT;
