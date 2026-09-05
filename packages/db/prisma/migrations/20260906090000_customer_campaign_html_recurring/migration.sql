-- Two additions to customer campaigns:
--   1. a real HTML body for email
--   2. recurring sends, not just the one-time welcome on signup
--
-- Creating brand-new enum types in the same migration that uses them is fine.
-- The Postgres restriction is only on ADDING A VALUE to an existing enum.

-- ── 1. HTML email ──────────────────────────────────────────────────────────
-- The plain-text body stays and is still sent as the text/plain alternative:
-- some clients block HTML outright, and a mail with no text part scores worse
-- with spam filters.
ALTER TABLE "customer_campaign_templates"
  ADD COLUMN "body_html_en" TEXT,
  ADD COLUMN "body_html_bn" TEXT;

-- ── 2. Recurring ───────────────────────────────────────────────────────────
CREATE TYPE "CustomerCampaignTrigger" AS ENUM ('CUSTOMER_ADDED', 'RECURRING');
CREATE TYPE "CustomerCampaignAudience" AS ENUM ('ALL', 'NO_ORDER_IN_DAYS');

ALTER TABLE "customer_campaign_templates"
  ADD COLUMN "trigger" "CustomerCampaignTrigger" NOT NULL DEFAULT 'CUSTOMER_ADDED',
  ADD COLUMN "audience" "CustomerCampaignAudience" NOT NULL DEFAULT 'ALL',
  -- Used by NO_ORDER_IN_DAYS: "customers with no order in the last N days".
  ADD COLUMN "audience_days" INTEGER,
  -- The cool-off. A recurring template will not reach the same customer again
  -- until this many days have passed, whatever the scan finds.
  ADD COLUMN "repeat_every_days" INTEGER;

-- Which send cycle a queued row belongs to. 'once' for the welcome sequence,
-- the enqueue date for a recurring send.
--
-- This is what lets the dedupe index stay strict AND allow legitimate repeats:
-- without it, "one row per customer per template per channel" would make a
-- recurring campaign fire exactly once, ever.
ALTER TABLE "customer_campaign_queue"
  ADD COLUMN "cycle_key" TEXT NOT NULL DEFAULT 'once';

DROP INDEX "customer_campaign_queue_customer_template_channel_key";
CREATE UNIQUE INDEX "customer_campaign_queue_customer_template_channel_cycle_key"
  ON "customer_campaign_queue"("customer_id", "template_id", "channel", "cycle_key");

-- The recurring scan asks "when did this customer last get this template?".
CREATE INDEX "customer_campaign_queue_customer_template_created_idx"
  ON "customer_campaign_queue"("customer_id", "template_id", "created_at");
