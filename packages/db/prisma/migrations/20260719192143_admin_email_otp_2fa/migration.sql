/*
  Warnings:

  - You are about to drop the column `two_factor_secret` on the `admin_users` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "OtpPurpose" ADD VALUE 'ADMIN_LOGIN';

-- AlterTable
ALTER TABLE "admin_users" DROP COLUMN "two_factor_secret";
