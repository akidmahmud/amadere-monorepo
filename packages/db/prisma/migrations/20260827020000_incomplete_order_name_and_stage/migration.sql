-- Cart-abandonment recovery: capture the shopper's NAME (so a guest who never
-- signs in is still reachable) and index the stage the admin list filters on.
-- Hand-written + `migrate deploy`: `prisma migrate dev` cannot run in this
-- repo (pre-existing FK violation in 20260807103916_promo_videos_standalone
-- fails the shadow database).
ALTER TABLE "incomplete_orders" ADD COLUMN "name" TEXT;
CREATE INDEX "incomplete_orders_stage_last_seen_at_idx" ON "incomplete_orders" ("stage", "last_seen_at");
