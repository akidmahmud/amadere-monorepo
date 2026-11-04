-- Optional contact person on a wholesale buyer.
ALTER TABLE "parties" ADD COLUMN "contact_name" TEXT;
ALTER TABLE "parties" ADD COLUMN "contact_phone" TEXT;
ALTER TABLE "parties" ADD COLUMN "contact_designation" TEXT;
