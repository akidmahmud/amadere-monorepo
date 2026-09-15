-- CRM fields for wholesale buyers (parties with the WHOLESALE role), matching
-- the retail customers' CRM block so the wholesale Customer Dashboard can be
-- edited and imported the same way. All nullable or defaulted: existing
-- parties (suppliers, couriers, buyers) are unaffected.
ALTER TABLE "parties"
  ADD COLUMN "is_favorite" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "dob" DATE,
  ADD COLUMN "assigned_admin_id" INTEGER,
  ADD COLUMN "next_call_target" DATE,
  ADD COLUMN "follow_up_cadence_days" INTEGER,
  ADD COLUMN "has_new_order" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "new_order_at" DATE,
  ADD COLUMN "priority" "CustomerPriority",
  ADD COLUMN "crm_status" "CustomerCrmStatus",
  ADD COLUMN "behaviour" "CustomerBehaviour",
  ADD COLUMN "customer_feedback" TEXT,
  ADD COLUMN "amader_feedback" TEXT,
  ADD COLUMN "family_details" TEXT,
  ADD COLUMN "purchase_reason" TEXT,
  ADD COLUMN "facebook_profile_url" TEXT;

ALTER TABLE "parties" ADD CONSTRAINT "parties_assigned_admin_id_fkey"
  FOREIGN KEY ("assigned_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
