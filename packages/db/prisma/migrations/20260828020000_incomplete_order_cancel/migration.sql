-- Let staff explicitly give up on an abandoned cart and record why, instead
-- of the only options being "recover it" or "delete it and lose the reason".
-- canceled_at doubles as the flag: a row is canceled iff it is not null.
-- Hand-written + `migrate deploy`: `prisma migrate dev` cannot run in this
-- repo (pre-existing FK violation in 20260807103916_promo_videos_standalone).
ALTER TABLE "incomplete_orders" ADD COLUMN "canceled_at" TIMESTAMP(3);
ALTER TABLE "incomplete_orders" ADD COLUMN "cancel_reason" TEXT;
