-- CreateEnum
CREATE TYPE "CustomerPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "CustomerCrmStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'FOLLOW_UP', 'DONE');

-- CreateEnum
CREATE TYPE "CustomerBehaviour" AS ENUM ('LOYAL', 'PRICE_SENSITIVE', 'OCCASIONAL');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "amader_feedback" TEXT,
ADD COLUMN     "assigned_admin_id" INTEGER,
ADD COLUMN     "behaviour" "CustomerBehaviour",
ADD COLUMN     "crm_status" "CustomerCrmStatus",
ADD COLUMN     "customer_feedback" TEXT,
ADD COLUMN     "facebook_profile_url" TEXT,
ADD COLUMN     "family_details" TEXT,
ADD COLUMN     "follow_up_cadence_days" INTEGER,
ADD COLUMN     "has_new_order" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_favorite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "new_order_at" DATE,
ADD COLUMN     "next_call_target" DATE,
ADD COLUMN     "priority" "CustomerPriority",
ADD COLUMN     "purchase_reason" TEXT;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_assigned_admin_id_fkey" FOREIGN KEY ("assigned_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
