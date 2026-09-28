-- POS SMS automation: campaigns + per-customer delivery record.
CREATE TYPE "PosSmsCampaignType" AS ENUM ('NOW', 'SCHEDULED', 'RECURRING', 'TIER_UPGRADE', 'WINBACK');


-- CreateTable
CREATE TABLE "pos_sms_campaigns" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "store_id" INTEGER,
    "tier_key" TEXT,
    "type" "PosSmsCampaignType" NOT NULL,
    "message" TEXT NOT NULL,
    "send_at" TIMESTAMP(3),
    "repeat" TEXT,
    "next_run_at" TIMESTAMP(3),
    "winback_days" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_sms_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_sms_deliveries" (
    "id" SERIAL NOT NULL,
    "campaign_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_sms_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pos_sms_campaigns_active_next_run_at_idx" ON "pos_sms_campaigns"("active", "next_run_at");

-- CreateIndex
CREATE UNIQUE INDEX "pos_sms_deliveries_campaign_id_customer_id_key_key" ON "pos_sms_deliveries"("campaign_id", "customer_id", "key");

ALTER TABLE "pos_sms_campaigns" ADD CONSTRAINT "pos_sms_campaigns_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_sms_deliveries" ADD CONSTRAINT "pos_sms_deliveries_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "pos_sms_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_sms_deliveries" ADD CONSTRAINT "pos_sms_deliveries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
