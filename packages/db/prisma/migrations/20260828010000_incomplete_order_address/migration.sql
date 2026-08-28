-- Capture the shipping address a shopper had typed before abandoning, so
-- staff re-creating the order do not have to ask for it again.
-- Hand-written + `migrate deploy`: `prisma migrate dev` cannot run in this
-- repo (pre-existing FK violation in 20260807103916_promo_videos_standalone).
ALTER TABLE "incomplete_orders" ADD COLUMN "address" JSONB;
