-- Welcome/onboarding campaigns aimed at CUSTOMERS, by email and/or SMS.
--
-- Deliberately a parallel pair of tables rather than a generalisation of
-- cart_campaign_*: that engine is a live money path (abandoned-cart
-- recovery), and widening its schema to carry two different subject types
-- would put every existing recovery send at risk to save two tables.
--
-- Reuses the existing CampaignChannel / DelayUnit / CampaignStatus /
-- QueueStatus enums — no new enum values, so this needs no separate
-- ALTER TYPE migration.
CREATE TABLE "customer_campaign_templates" (
  "id"          SERIAL PRIMARY KEY,
  "channel"     "CampaignChannel" NOT NULL,
  "name"        TEXT NOT NULL,
  -- Email only; NULL for SMS.
  "subject"     TEXT,
  "body_en"     TEXT NOT NULL,
  "body_bn"     TEXT NOT NULL,
  -- How long after the customer was added this step fires.
  "delay_value" INTEGER NOT NULL DEFAULT 0,
  "delay_unit"  "DelayUnit" NOT NULL DEFAULT 'MINUTE',
  "status"      "CampaignStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "customer_campaign_queue" (
  "id"           SERIAL PRIMARY KEY,
  "customer_id"  INTEGER NOT NULL,
  "template_id"  INTEGER NOT NULL,
  "channel"      "CampaignChannel" NOT NULL,
  -- Snapshotted at enqueue time: the address we will actually send to, so a
  -- later profile edit cannot silently redirect a queued message.
  "recipient"    TEXT,
  "status"       "QueueStatus" NOT NULL DEFAULT 'PENDING',
  "attempts"     INTEGER NOT NULL DEFAULT 0,
  "scheduled_at" TIMESTAMP(3) NOT NULL,
  -- Worker claim lock, so two ticks cannot double-send the same step.
  "locked_at"    TIMESTAMP(3),
  "processed_at" TIMESTAMP(3),
  "last_error"   TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "customer_campaign_queue_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE,
  CONSTRAINT "customer_campaign_queue_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "customer_campaign_templates"("id") ON DELETE CASCADE
);

-- One step per customer per template per channel, ever. This is what stops a
-- re-run of the enqueue (or a retried signup) mailing somebody twice.
CREATE UNIQUE INDEX "customer_campaign_queue_customer_template_channel_key"
  ON "customer_campaign_queue"("customer_id", "template_id", "channel");

-- The worker's only query: due and pending.
CREATE INDEX "customer_campaign_queue_status_scheduled_at_idx"
  ON "customer_campaign_queue"("status", "scheduled_at");
