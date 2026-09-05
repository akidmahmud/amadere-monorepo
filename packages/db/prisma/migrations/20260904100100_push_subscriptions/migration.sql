-- One row per BROWSER that granted notification permission, not per customer:
-- the endpoint is the identity the push service issues, so the same person on a
-- phone and a laptop is two rows.
CREATE TABLE "push_subscriptions" (
  "id"           SERIAL PRIMARY KEY,
  "endpoint"     TEXT NOT NULL,
  "p256dh"       TEXT NOT NULL,
  "auth"         TEXT NOT NULL,
  "customer_id"  INTEGER,
  "user_agent"   TEXT,
  "locale"       TEXT NOT NULL DEFAULT 'EN',
  -- Set when the push service reports the subscription is gone (404/410).
  -- Kept rather than deleted so the opt-in funnel stays measurable.
  "revoked_at"   TIMESTAMP(3),
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL
);

-- Re-subscribing the same browser must UPDATE, never insert a duplicate that
-- would deliver the same notification twice.
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");
CREATE INDEX "push_subscriptions_customer_id_revoked_at_idx" ON "push_subscriptions"("customer_id", "revoked_at");
CREATE INDEX "push_subscriptions_revoked_at_idx" ON "push_subscriptions"("revoked_at");

ALTER TABLE "push_subscriptions"
  ADD CONSTRAINT "push_subscriptions_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
