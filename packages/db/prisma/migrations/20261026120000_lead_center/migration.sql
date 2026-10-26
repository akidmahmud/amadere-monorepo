-- Lead Center: leads (not yet customers) and their call log.
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'INTERESTED', 'FOLLOW_UP', 'CONVERTED', 'LOST', 'DNC');
CREATE TYPE "LeadCallOutcome" AS ENUM ('ANSWERED_INTERESTED', 'ANSWERED_CALL_BACK', 'ANSWERED_REGULAR_BUYER', 'ANSWERED_WHOLESALE', 'NO_ANSWER', 'BUSY', 'NUMBER_OFF', 'NOT_INTERESTED', 'WRONG_NUMBER', 'DO_NOT_CALL', 'ORDER_PLACED');

CREATE TABLE "leads" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "alt_phone" TEXT,
    "address_line" TEXT,
    "district" TEXT,
    "area" TEXT,
    "lead_source" TEXT,
    "lead_date" DATE,
    "interested_product" TEXT,
    "assigned_admin_id" INTEGER,
    "priority" "CustomerPriority",
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "next_call_date" DATE,
    "last_call_at" TIMESTAMP(3),
    "lost_reason" TEXT,
    "customer_feedback" TEXT,
    "agent_feedback" TEXT,
    "family_details" TEXT,
    "purchase_reason" TEXT,
    "converted_customer_id" INTEGER,
    "converted_order_id" INTEGER,
    "converted_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lead_call_logs" (
    "id" SERIAL NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "outcome" "LeadCallOutcome" NOT NULL,
    "notes" TEXT,
    "author_admin_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lead_call_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "leads_phone_idx" ON "leads"("phone");
CREATE INDEX "leads_converted_at_deleted_at_idx" ON "leads"("converted_at", "deleted_at");
CREATE INDEX "leads_assigned_admin_id_idx" ON "leads"("assigned_admin_id");
CREATE INDEX "lead_call_logs_lead_id_idx" ON "lead_call_logs"("lead_id");
CREATE INDEX "lead_call_logs_created_at_idx" ON "lead_call_logs"("created_at");

ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_admin_id_fkey" FOREIGN KEY ("assigned_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lead_call_logs" ADD CONSTRAINT "lead_call_logs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lead_call_logs" ADD CONSTRAINT "lead_call_logs_author_admin_id_fkey" FOREIGN KEY ("author_admin_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
