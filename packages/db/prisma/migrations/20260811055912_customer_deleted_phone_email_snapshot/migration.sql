-- Customer.phone/email are @unique across ALL rows regardless of deletedAt,
-- so a soft-deleted customer permanently squats their phone/email and blocks
-- a brand new registration with the same number. These two snapshot columns
-- let the delete flow null out phone/email (freeing them for reuse) while
-- still being able to restore the original values within the app's own
-- retention window.
ALTER TABLE "customers" ADD COLUMN "deleted_phone" TEXT;
ALTER TABLE "customers" ADD COLUMN "deleted_email" TEXT;
